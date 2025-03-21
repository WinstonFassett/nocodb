<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'
import { message } from 'ant-design-vue'
import tinycolor from 'tinycolor2'
import type { Select as AntSelect } from 'ant-design-vue'
import type { SelectOptionType } from 'nocodb-sdk'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditModeInj,
  IsFormInj,
  IsKanbanInj,
  ReadonlyInj,
  computed,
  enumColor,
  extractSdkResponseErrorMsg,
  iconMap,
  inject,
  isDrawerOrModalExist,
  ref,
  useEventListener,
  useProject,
  useRoles,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | undefined
  rowIndex?: number
  disableOptionCreation?: boolean
}

const { modelValue, disableOptionCreation } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj)!

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const aselect = ref<typeof AntSelect>()

const isOpen = ref(false)

const isKanban = inject(IsKanbanInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isForm = inject(IsFormInj, ref(false))

const { $api } = useNuxtApp()

const searchVal = ref()

const { getMeta } = useMetas()

const { hasRole } = useRoles()

const { isPg, isMysql } = useProject()

// a variable to keep newly created option value
// temporary until it's add the option to column meta
const tempSelectedOptState = ref<string>()

const options = computed<(SelectOptionType & { value: string })[]>(() => {
  if (column?.value.colOptions) {
    const opts = column.value.colOptions
      ? // todo: fix colOptions type, options does not exist as a property
        (column.value.colOptions as any).options.filter((el: SelectOptionType) => el.title !== '') || []
      : []
    for (const op of opts.filter((el: any) => el.order === null)) {
      op.title = op.title.replace(/^'/, '').replace(/'$/, '')
    }
    return opts.map((o: any) => ({ ...o, value: o.title }))
  }
  return []
})

const isOptionMissing = computed(() => {
  return (options.value ?? []).every((op) => op.title !== searchVal.value)
})

const hasEditRoles = computed(() => hasRole('owner', true) || hasRole('creator', true) || hasRole('editor', true))

const editAllowed = computed(() => (hasEditRoles.value || isForm.value) && (active.value || editable.value))

const vModel = computed({
  get: () => tempSelectedOptState.value ?? modelValue,
  set: (val) => {
    if (isOptionMissing.value && val === searchVal.value) {
      tempSelectedOptState.value = val
      return addIfMissingAndSave().finally(() => {
        tempSelectedOptState.value = undefined
      })
    }
    emit('update:modelValue', val || null)
  },
})

watch(isOpen, (n, _o) => {
  if (editAllowed.value) {
    if (!n) {
      aselect.value?.$el?.querySelector('input')?.blur()
    } else {
      aselect.value?.$el?.querySelector('input')?.focus()
    }
  }
})

useSelectedCellKeyupListener(active, (e) => {
  switch (e.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'Enter':
      if (editAllowed.value && active.value && !isOpen.value) {
        isOpen.value = true
      }
      break
    // skip space bar key press since it's used for expand row
    case ' ':
      break
    default:
      if (!editAllowed.value) {
        e.preventDefault()
        break
      }
      // toggle only if char key pressed
      if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && e.key?.length === 1 && !isDrawerOrModalExist()) {
        e.stopPropagation()
        isOpen.value = true
      }
      break
  }
})

// close dropdown list on escape
useSelectedCellKeyupListener(isOpen, (e) => {
  if (e.key === 'Escape') isOpen.value = false
})

async function addIfMissingAndSave() {
  if (!searchVal.value || isPublic.value) return false

  const newOptValue = searchVal.value
  searchVal.value = ''

  if (newOptValue && !options.value.some((o) => o.title === newOptValue)) {
    try {
      options.value.push({
        title: newOptValue,
        value: newOptValue,
        color: enumColor.light[(options.value.length + 1) % enumColor.light.length],
      })
      column.value.colOptions = { options: options.value.map(({ value: _, ...rest }) => rest) }

      const updatedColMeta = { ...column.value }

      // todo: refactor and avoid repetition
      if (updatedColMeta.cdf) {
        // Postgres returns default value wrapped with single quotes & casted with type so we have to get value between single quotes to keep it unified for all databases
        if (isPg(column.value.base_id)) {
          updatedColMeta.cdf = updatedColMeta.cdf.substring(
            updatedColMeta.cdf.indexOf(`'`) + 1,
            updatedColMeta.cdf.lastIndexOf(`'`),
          )
        }

        // Mysql escapes single quotes with backslash so we keep quotes but others have to unescaped
        if (!isMysql(column.value.base_id)) {
          updatedColMeta.cdf = updatedColMeta.cdf.replace(/''/g, "'")
        }
      }

      await $api.dbTableColumn.update(
        (column.value as { fk_column_id?: string })?.fk_column_id || (column.value?.id as string),
        updatedColMeta,
      )
      vModel.value = newOptValue
      await getMeta(column.value.fk_model_id!, true)
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }
}

const search = () => {
  searchVal.value = aselect.value?.$el?.querySelector('.ant-select-selection-search-input')?.value
}

// prevent propagation of keydown event if select is open
const onKeydown = (e: KeyboardEvent) => {
  if (isOpen.value && (active.value || editable.value)) {
    e.stopPropagation()
  }
  if (e.key === 'Enter') {
    e.stopPropagation()
  }
}

const onSelect = () => {
  isOpen.value = false
}

const cellClickHook = inject(CellClickHookInj, null)

const toggleMenu = (e: Event) => {
  // todo: refactor
  // check clicked element is clear icon
  if (
    (e.target as HTMLElement)?.classList.contains('ant-select-clear') ||
    (e.target as HTMLElement)?.closest('.ant-select-clear')
  ) {
    vModel.value = ''
    return e.stopPropagation()
  }
  if (cellClickHook) return
  isOpen.value = editAllowed.value && !isOpen.value
}

const cellClickHookHandler = () => {
  isOpen.value = editAllowed.value && !isOpen.value
}
onMounted(() => {
  cellClickHook?.on(cellClickHookHandler)
})
onUnmounted(() => {
  cellClickHook?.on(cellClickHookHandler)
})

const handleClose = (e: MouseEvent) => {
  if (isOpen.value && aselect.value && !aselect.value.$el.contains(e.target)) {
    isOpen.value = false
  }
}

useEventListener(document, 'click', handleClose, true)
</script>

<template>
  <div class="h-full w-full flex items-center nc-single-select" :class="{ 'read-only': readOnly }" @click="toggleMenu">
    <a-select
      ref="aselect"
      v-model:value="vModel"
      class="w-full overflow-hidden"
      :class="{ 'caret-transparent': !hasEditRoles }"
      :allow-clear="!column.rqd && editAllowed"
      :bordered="false"
      :open="isOpen && editAllowed"
      :disabled="readOnly || !editAllowed"
      :show-arrow="hasEditRoles && !readOnly && (editable || (active && vModel === null))"
      :dropdown-class-name="`nc-dropdown-single-select-cell ${isOpen && (active || editable) ? 'active' : ''}`"
      :show-search="isOpen && (active || editable)"
      @select="onSelect"
      @keydown="onKeydown($event)"
      @search="search"
    >
      <a-select-option
        v-for="op of options"
        :key="op.title"
        :value="op.title"
        :data-testid="`select-option-${column.title}-${rowIndex}`"
        :class="`nc-select-option-${column.title}-${op.title}`"
        @click.stop
      >
        <a-tag class="rounded-tag" :color="op.color">
          <span
            :style="{
              'color': tinycolor.isReadable(op.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                ? '#fff'
                : tinycolor.mostReadable(op.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
              'font-size': '13px',
            }"
            :class="{ 'text-sm': isKanban }"
          >
            {{ op.title }}
          </span>
        </a-tag>
      </a-select-option>
      <a-select-option
        v-if="
          searchVal &&
          isOptionMissing &&
          !isPublic &&
          !disableOptionCreation &&
          (hasRole('owner', true) || hasRole('creator', true))
        "
        :key="searchVal"
        :value="searchVal"
      >
        <div class="flex gap-2 text-gray-500 items-center h-full">
          <component :is="iconMap.plusThick" class="min-w-4" />
          <div class="text-xs whitespace-normal">
            Create new option named <strong>{{ searchVal }}</strong>
          </div>
        </div>
      </a-select-option>
    </a-select>
  </div>
</template>

<style scoped lang="scss">
.rounded-tag {
  @apply py-0 px-[12px] rounded-[12px];
}

:deep(.ant-tag) {
  @apply "rounded-tag";
}

:deep(.ant-select-clear) {
  opacity: 1;
}

.nc-single-select:not(.read-only) {
  :deep(.ant-select-selector),
  :deep(.ant-select-selector input) {
    @apply !cursor-pointer;
  }
}

:deep(.ant-select-selector) {
  @apply !px-0;
}

:deep(.ant-select-selection-search) {
  // following a-select with mode = multiple | tags
  // initial width will block @mouseover in Grid.vue
  @apply !w-[5px];
}

:deep(.ant-select-selection-search-input) {
  @apply !text-xs;
}

:deep(.ant-select-clear > span) {
  @apply block;
}
</style>
