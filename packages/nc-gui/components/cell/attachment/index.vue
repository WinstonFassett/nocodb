<script setup lang="ts">
import { onKeyDown } from '@vueuse/core'
import { useProvideAttachmentCell } from './utils'
import { useSortable } from './sort'
import {
  ActiveCellInj,
  DropZoneRef,
  IsGalleryInj,
  IsKanbanInj,
  iconMap,
  inject,
  isImage,
  nextTick,
  ref,
  useAttachment,
  useDropZone,
  useSelectedCellKeyupListener,
  useSmartsheetRowStoreOrThrow,
  useSmartsheetStoreOrThrow,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | Record<string, any>[] | null
  rowIndex?: number
}

interface Emits {
  (event: 'update:modelValue', value: string | Record<string, any>[]): void
}

const { modelValue, rowIndex } = defineProps<Props>()

const emits = defineEmits<Emits>()

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const dropZoneInjection = inject(DropZoneRef, ref())

const attachmentCellRef = ref<HTMLDivElement>()

const sortableRef = ref<HTMLDivElement>()

const currentCellRef = ref<Element | undefined>(dropZoneInjection.value)

const { cellRefs, isSharedForm } = useSmartsheetStoreOrThrow()!

const { getPossibleAttachmentSrc, openAttachment } = useAttachment()

const {
  isPublic,
  isForm,
  column,
  modalVisible,
  attachments,
  visibleItems,
  onDrop,
  isLoading,
  open,
  FileIcon,
  selectedImage,
  isReadonly,
  storedFiles,
} = useProvideAttachmentCell(updateModelValue)

watch(
  [() => rowIndex, isForm, attachmentCellRef],
  () => {
    if (dropZoneInjection?.value) return

    if (!rowIndex && (isForm.value || isGallery.value || isKanban.value)) {
      currentCellRef.value = attachmentCellRef.value
    } else {
      nextTick(() => {
        const nextCell = cellRefs.value.reduceRight((cell, curr) => {
          if (!cell && curr.dataset.key === `${rowIndex}${column.value!.id}`) cell = curr

          return cell
        }, undefined as HTMLTableDataCellElement | undefined)

        if (!nextCell) {
          currentCellRef.value = attachmentCellRef.value
        } else {
          currentCellRef.value = nextCell
        }
      })
    }
  },
  { immediate: true, flush: 'post' },
)

const { dragging } = useSortable(sortableRef, visibleItems, updateModelValue, isReadonly)

const { state: rowState } = useSmartsheetRowStoreOrThrow()

const { isOverDropZone } = useDropZone(currentCellRef as any, onDrop)

/** on new value, reparse our stored attachments */
watch(
  () => modelValue,
  async (nextModel) => {
    if (nextModel) {
      try {
        const nextAttachments = ((typeof nextModel === 'string' ? JSON.parse(nextModel) : nextModel) || []).filter(Boolean)

        if (isPublic.value && isForm.value) {
          storedFiles.value = nextAttachments
        } else {
          attachments.value = nextAttachments
        }
      } catch (e) {
        console.error(e)
        if (isPublic.value && isForm.value) {
          storedFiles.value = []
        } else {
          attachments.value = []
        }
      }
    } else {
      if (isPublic.value && isForm.value) {
        storedFiles.value = []
      } else {
        attachments.value = []
      }
    }
  },
  {
    immediate: true,
  },
)

/** updates attachments array for autosave */
function updateModelValue(data: string | Record<string, any>[]) {
  emits('update:modelValue', data)
}

/** Close modal on escape press, disable dropzone as well */
onKeyDown('Escape', () => {
  modalVisible.value = false
  isOverDropZone.value = false
})

/** sync storedFiles state with row state */
watch(
  () => storedFiles.value.length || 0,
  () => {
    rowState.value[column.value!.title!] = storedFiles.value
  },
)

useSelectedCellKeyupListener(inject(ActiveCellInj, ref(false)), (e) => {
  if (e.key === 'Enter' && !isReadonly.value) {
    e.stopPropagation()
    if (!modalVisible.value) {
      modalVisible.value = true
    } else {
      // click Attach File button
      ;(document.querySelector('.nc-attachment-modal.active .nc-attach-file') as HTMLDivElement)?.click()
    }
  }
})
</script>

<template>
  <div
    ref="attachmentCellRef"
    class="nc-attachment-cell relative flex-1 color-transition flex items-center justify-between gap-1"
  >
    <LazyCellAttachmentCarousel />

    <template v-if="isSharedForm || (!isReadonly && !dragging && !!currentCellRef)">
      <general-overlay
        v-model="isOverDropZone"
        inline
        :target="currentCellRef"
        class="nc-attachment-cell-dropzone text-white text-lg ring ring-accent ring-opacity-100 bg-gray-700/75 flex items-center justify-center gap-2 backdrop-blur-xl"
      >
        <MaterialSymbolsFileCopyOutline class="text-accent" />
        Drop here
      </general-overlay>
    </template>

    <div
      v-if="!isReadonly"
      :class="{ 'mx-auto px-4': !visibleItems.length }"
      class="group cursor-pointer flex gap-1 items-center active:(ring ring-accent ring-opacity-100) rounded border-1 p-1 shadow-sm hover:(bg-primary bg-opacity-10) dark:(!bg-slate-500)"
      data-testid="attachment-cell-file-picker-button"
      @click.stop="open"
    >
      <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

      <a-tooltip v-else placement="bottom">
        <template #title> Click or drop a file into cell</template>

        <div class="flex items-center gap-2">
          <MaterialSymbolsAttachFile
            class="transform dark:(!text-white) group-hover:(!text-accent scale-120) text-gray-500 text-[0.75rem]"
          />

          <div
            v-if="!visibleItems.length"
            class="group-hover:text-primary text-gray-500 dark:text-gray-200 dark:group-hover:!text-white text-xs"
          >
            Add file(s)
          </div>
        </div>
      </a-tooltip>
    </div>

    <div v-else class="flex" />

    <template v-if="visibleItems.length">
      <div
        ref="sortableRef"
        :class="{ dragging }"
        class="flex cursor-pointer justify-center items-center flex-wrap gap-2 p-1 scrollbar-thin-dull max-h-[150px] overflow-auto"
      >
        <template v-for="(item, i) of visibleItems" :key="item.url || item.title">
          <a-tooltip placement="bottom">
            <template #title>
              <div class="text-center w-full">{{ item.title }}</div>
            </template>
            <div v-if="isImage(item.title, item.mimetype ?? item.type)">
              <div class="nc-attachment flex items-center justify-center" @click.stop="selectedImage = item">
                <LazyCellAttachmentImage :alt="item.title || `#${i}`" :srcs="getPossibleAttachmentSrc(item)" />
              </div>
            </div>
            <div v-else class="nc-attachment flex items-center justify-center" @click="openAttachment(item)">
              <component :is="FileIcon(item.icon)" v-if="item.icon" />

              <IcOutlineInsertDriveFile v-else />
            </div>
          </a-tooltip>
        </template>
      </div>

      <div
        class="group cursor-pointer flex gap-1 items-center active:(ring ring-accent ring-opacity-100) rounded border-1 p-1 shadow-sm hover:(bg-primary bg-opacity-10) dark:(!bg-slate-500)"
      >
        <component :is="iconMap.reload" v-if="isLoading" :class="{ 'animate-infinite animate-spin': isLoading }" />

        <a-tooltip v-else placement="bottom">
          <template #title> View attachments</template>

          <component
            :is="iconMap.expand"
            class="transform dark:(!text-white) group-hover:(!text-accent scale-120) text-gray-500 text-[0.75rem]"
            @click.stop="modalVisible = true"
          />
        </a-tooltip>
      </div>
    </template>

    <LazyCellAttachmentModal />
  </div>
</template>

<style lang="scss">
.nc-cell {
  .nc-attachment-cell {
    .nc-attachment {
      @apply w-[50px] h-[50px] min-h-[50px] min-w-[50px] ring-1 ring-gray-300 rounded;
    }

    .ghost,
    .ghost > * {
      @apply !pointer-events-none;
    }

    .dragging {
      .ant-tooltip {
        @apply !hidden;
      }
    }
  }
}
</style>
