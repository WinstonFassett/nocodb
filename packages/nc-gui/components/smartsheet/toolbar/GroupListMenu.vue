<script setup lang="ts">
import { nextTick } from '@vue/runtime-core'
import type { ColumnType } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsLockedInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  getSortDirectionOptions,
  iconMap,
  inject,
  ref,
  useMenuCloseOnEsc,
  useSmartsheetStoreOrThrow,
  useViewGroups,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())
const view = inject(ActiveViewInj, ref())
const isLocked = inject(IsLockedInj, ref(false))
const reloadDataHook = inject(ReloadViewDataHookInj)

const { eventBus } = useSmartsheetStoreOrThrow()

const { groups, saveOrUpdate, loadGroups, addGroup: _addGroup, deleteGroup } = useViewGroups(view, () => reloadDataHook?.trigger())

const removeIcon = ref<HTMLElement>()

const addGroup = () => {
  _addGroup()
  nextTick(() => {
    removeIcon.value?.[removeIcon.value?.length - 1]?.$el?.scrollIntoView()
  })
}

const { isMobileMode } = useGlobal()

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.SORT_RELOAD) {
    loadGroups()
  }
})

const columns = computed(() => meta.value?.columns || [])

const columnByID = computed(() =>
  columns.value.reduce((obj, col) => {
    obj[col.id!] = col

    return obj
  }, {} as Record<string, ColumnType>),
)

const getColumnUidtByID = (key?: string) => {
  if (!key) return ''
  return columnByID.value[key]?.uidt || ''
}

watch(
  () => view.value?.id,
  (viewId) => {
    if (viewId) loadGroups()
  },
  { immediate: true },
)

const open = ref(false)

useMenuCloseOnEsc(open)
</script>

<template>
  <a-dropdown v-model:visible="open" offset-y class="" :trigger="['click']" overlay-class-name="nc-dropdown-group-menu">
    <div :class="{ 'nc-badge nc-active-btn': groups?.length }">
      <a-button v-e="['c:group']" class="nc-group-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <component :is="iconMap.group" />

          <!-- Group -->
          <span v-if="!isMobileMode" class="text-capitalize !text-xs font-weight-normal">{{ $t('activity.group') }}</span>
          <component :is="iconMap.arrowDown" class="text-grey" />

          <span v-if="groups?.length" class="nc-count-badge">{{ groups.length }}</span>
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        :class="{ ' min-w-[400px]': groups.length }"
        class="bg-gray-50 p-6 shadow-lg menu-filter-dropdown max-h-[max(80vh,500px)] overflow-auto !border"
        data-testid="nc-groups-menu"
      >
        <div v-if="groups?.length" class="group-grid mb-2 max-h-420px overflow-y-auto" @click.stop>
          <template v-for="(group, i) of groups" :key="i">
            <component
              :is="iconMap.closeBox"
              ref="removeIcon"
              class="nc-group-item-remove-btn text-grey self-center"
              small
              @click.stop="deleteGroup(group, i)"
            />

            <LazySmartsheetToolbarFieldListAutoCompleteDropdown
              v-model="group.fk_column_id"
              class="caption nc-group-field-select"
              :columns="columns"
              is-group
              @click.stop
              @update:model-value="saveOrUpdate(group, i)"
            />

            <a-select
              ref=""
              v-model:value="group.direction"
              class="shrink grow-0 nc-group-dir-select !text-xs"
              :label="$t('labels.operation')"
              dropdown-class-name="group-dir-dropdown nc-dropdown-group-dir"
              @click.stop
              @select="saveOrUpdate(group, i)"
            >
              <a-select-option
                v-for="(option, j) of getSortDirectionOptions(getColumnUidtByID(group.fk_column_id))"
                :key="j"
                :value="option.value"
              >
                <span>{{ option.text }}</span>
              </a-select-option>
            </a-select>
          </template>
        </div>

        <a-button class="text-capitalize mb-1 mt-4" type="primary" ghost @click.stop="addGroup">
          <div class="flex gap-1 items-center">
            <component :is="iconMap.plus" />
            <!-- Add Group Option -->
            {{ $t('activity.addGroup') }}
          </div>
        </a-button>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.group-grid {
  display: grid;
  grid-template-columns: 22px auto 150px;
  @apply gap-[12px];
}
</style>
