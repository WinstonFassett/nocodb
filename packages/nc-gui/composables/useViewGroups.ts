import type { GroupType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import {
  IsPublicInj,
  ReloadViewDataHookInj,
  extractSdkResponseErrorMsg,
  inject,
  message,
  ref,
  storeToRefs,
  useNuxtApp,
  useProject,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'
import type { TabItem } from '~/lib'

export function useViewGroups(view: Ref<ViewType | undefined>, reloadData?: () => void) {
  const { sharedView } = useSharedView()

  const { groups } = useSmartsheetStoreOrThrow()

  const { $api, $e } = useNuxtApp()

  const { isUIAllowed } = useUIPermission()

  const { isSharedBase } = storeToRefs(useProject())

  const reloadHook = inject(ReloadViewDataHookInj)

  const isPublic = inject(IsPublicInj, ref(false))

  const tabMeta = inject(TabMetaInj, ref({ groupsState: new Map() } as TabItem))

  const loadGroups = async () => {
    if (isPublic.value) {
      // todo: groups missing on `ViewType`
      const sharedGroups = (sharedView.value as any)?.groups || []
      groups.value = [...sharedGroups]
      return
    }

    try {
      if (!isUIAllowed('groupsSync')) {
        const groupsBackup = tabMeta.value.groupsState!.get(view.value!.id!)
        if (groupsBackup) {
          groups.value = groupsBackup
          return
        }
      }
      if (!view?.value) return
      groups.value = (await $api.dbTableGroup.list(view.value!.id!)).list as GroupType[]
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdate = async (group: GroupType, i: number) => {
    if (isPublic.value || isSharedBase.value) {
      groups.value[i] = group
      groups.value = [...groups.value]
      reloadHook?.trigger()
      tabMeta.value.groupsState!.set(view.value!.id!, groups.value)
      return
    }

    try {
      if (isUIAllowed('groupsSync')) {
        if (group.id) {
          await $api.dbTableGroup.update(group.id, group)
          $e('group-updated')
        } else {
          groups.value[i] = (await $api.dbTableGroup.create(view.value?.id as string, group)) as unknown as GroupType
        }
      }
      reloadData?.()
      $e('a:group:dir', { direction: group.direction })
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }
  const addGroup = () => {
    groups.value = [
      ...groups.value,
      {
        direction: 'asc',
      },
    ]

    $e('a:group:add', { length: groups?.value?.length })

    tabMeta.value.groupsState!.set(view.value!.id!, groups.value)
  }

  const deleteGroup = async (group: GroupType, i: number) => {
    try {
      if (isUIAllowed('groupsSync') && group.id && !isPublic.value && !isSharedBase.value) {
        await $api.dbTableGroup.delete(group.id)
      }
      groups.value.splice(i, 1)
      groups.value = [...groups.value]

      tabMeta.value.groupsState!.set(view.value!.id!, groups.value)

      reloadHook?.trigger()
      $e('a:group:delete')
    } catch (e: any) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return { groups, loadGroups, addGroup, deleteGroup, saveOrUpdate }
}
