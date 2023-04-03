<script lang="ts" setup>
import type { ColumnReqType, ColumnType, GridType, GroupType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  CellUrlDisableOverlayInj,
  ChangePageInj,
  FieldsInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsLockedInj,
  MetaInj,
  NavigateDir,
  OpenNewRecordFormHookInj,
  PaginationDataInj,
  ReadonlyInj,
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  RowHeightInj,
  SmartsheetStoreEvents,
  computed,
  createEventHook,
  enumColor,
  extractPkFromRow,
  iconMap,
  inject,
  isColumnRequiredAndNull,
  isDrawerOrModalExist,
  isMac,
  message,
  onBeforeUnmount,
  onClickOutside,
  onMounted,
  provide,
  ref,
  useEventListener,
  useGridViewColumnWidth,
  useI18n,
  useMetas,
  useMultiSelect,
  useNuxtApp,
  useRoles,
  useRoute,
  useSmartsheetStoreOrThrow,
  useUIPermission,
  useViewData,
  watch,
} from '#imports'
import type { Row } from '~/lib'

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { $e } = useNuxtApp()

// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const fields = inject(FieldsInj, ref([]))
const readOnly = inject(ReadonlyInj, ref(false))
const isLocked = inject(IsLockedInj, ref(false))

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const openNewRecordFormHook = inject(OpenNewRecordFormHookInj, createEventHook())

const { hasRole } = useRoles()
const { isUIAllowed } = useUIPermission()
const hasEditPermission = $computed(() => isUIAllowed('xcDatatableEditable'))

const route = useRoute()
const router = useRouter()

// todo: get from parent ( inject or use prop )
const isView = false

let editEnabled = $ref(false)

const { xWhere, isPkAvail, isSqlView, eventBus, groups } = useSmartsheetStoreOrThrow()

const visibleColLength = $computed(() => fields.value?.length)

const addColumnDropdown = ref(false)

const _contextMenu = ref(false)
const contextMenu = computed({
  get: () => _contextMenu.value,
  set: (val) => {
    if (hasEditPermission) {
      _contextMenu.value = val
    }
  },
})

const routeQuery = $computed(() => route.query as Record<string, string>)
const contextMenuTarget = ref<{ row: number; col: number } | null>(null)
const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()
const gridWrapper = ref<HTMLElement>()
const tableHead = ref<HTMLElement>()

const isAddingColumnAllowed = $computed(() => !readOnly.value && !isLocked.value && isUIAllowed('add-column') && !isSqlView.value)

const isAddingEmptyRowAllowed = $computed(() => !isView && !isLocked.value && hasEditPermission && !isSqlView.value)

const {
  isLoading,
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  selectedAllRecords,
  removeRowIfNew,
  navigateToSiblingRow,
  getExpandedRowIndex,
} = useViewData(meta, view, xWhere)

const groupCount = computed(() => {
  return groups.value?.length ?? 0
})

const isGrouping = computed(() => {
  return groupCount.value > 0
})

const groupFields = computed(() => {
  const groupFields = []  as FieldGroup[]
  groups.value?.forEach(group => {
    const { fk_column_id } = group
    if (fk_column_id) {
      const field = fields.value.find(field => field.id === fk_column_id )!
      groupFields.push({ group, field })
    }
  })
  return Object.freeze(groupFields)
})

interface FieldGroup {
  field: ColumnType
  group: GroupType
}

const finalRowIndex = computed(() => {
  const { isLastPage } = paginationData.value
  const rowCount = data.value.length
  return isLastPage ? rowCount-1 : -1
})

// create flattened, frozen view derived from data
const rowsWithGroups = computed(() => {
  const rows = data.value
  const rowCount = rows.length
  const groupFieldsArr = groupFields.value  
  if (!groupFieldsArr || groupFieldsArr.length === 0 || rowCount === 0) return null
  let activeGroupValueStack = [] as any[]
  let currentRowGroupValues = new Array(groupFieldsArr.length)

  const { isLastPage } = paginationData.value
  const enhancedRows = rows.map((row, rowIndex) => {
    const groupsStarting = [] as number[]
    let groupsEnded = []
    let groupsChanged = false

    groupFieldsArr.forEach(({ group, field }, groupIndex) => {
      const groupValue = row.row[field.title!] // index probably better(?)
      const prevRowGroupValue = currentRowGroupValues[groupIndex]
      const prevValue = prevRowGroupValue?.groupValue
      currentRowGroupValues[groupIndex] = {
        rowIndex,
        groupValue
      }
      if (groupsChanged || !prevRowGroupValue || groupValue !== prevRowGroupValue.groupValue) {
        groupsChanged = true
        if (prevRowGroupValue) {          
          groupsEnded.push({
            groupIndex,
            ...prevRowGroupValue
          })
        }        
        groupsStarting.push(groupIndex)
      }
    })    
    groupsEnded.pop()
    return Object.freeze({
      ...row,
      rowIndex,
      groupsStarting: Object.freeze(groupsStarting),
      groupsEnded: Object.freeze(groupsEnded.reverse()),
    })
  })
  return Object.freeze(enhancedRows)
})

const viewData = computed(() => {
  if (groups.value.length > 0) {
    return rowsWithGroups.value
  }
  return data.value
})

const { getMeta } = useMetas()

const { loadGridViewColumns, updateWidth, resizingColWidth, resizingCol } = useGridViewColumnWidth(view)

const getContainerScrollForElement = (
  el: HTMLElement,
  container: HTMLElement,
  offset?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  },
) => {
  const childPos = el.getBoundingClientRect()
  const parentPos = container.getBoundingClientRect()
  const relativePos = {
    top: childPos.top - parentPos.top,
    right: childPos.right - parentPos.right,
    bottom: childPos.bottom - parentPos.bottom,
    left: childPos.left - parentPos.left,
  }

  const scroll = {
    top: 0,
    left: 0,
  }

  /*
   * If the element is to the right of the container, scroll right (positive)
   * If the element is to the left of the container, scroll left (negative)
   */
  scroll.left =
    relativePos.right + (offset?.right || 0) > 0
      ? container.scrollLeft + relativePos.right + (offset?.right || 0)
      : relativePos.left - (offset?.left || 0) < 0
      ? container.scrollLeft + relativePos.left - (offset?.left || 0)
      : container.scrollLeft

  /*
   * If the element is below the container, scroll down (positive)
   * If the element is above the container, scroll up (negative)
   */
  scroll.top =
    relativePos.bottom + (offset?.bottom || 0) > 0
      ? container.scrollTop + relativePos.bottom + (offset?.bottom || 0)
      : relativePos.top - (offset?.top || 0) < 0
      ? container.scrollTop + relativePos.top - (offset?.top || 0)
      : container.scrollTop

  return scroll
}

const {
  isCellSelected,
  activeCell,
  handleMouseDown,
  handleMouseOver,
  handleCellClick,
  clearSelectedRange,
  copyValue,
  isCellActive,
  tbodyEl,
  resetSelectedRange,
} = useMultiSelect(
  meta,
  fields,
  data,
  $$(editEnabled),
  isPkAvail,
  clearCell,
  makeEditable,
  scrollToCell,
  (e: KeyboardEvent) => {
    // ignore navigating if picker(Date, Time, DateTime, Year)
    // or single/multi select options is open
    const activePickerOrDropdownEl = document.querySelector(
      '.nc-picker-datetime.active,.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active,.nc-picker-date.active,.nc-picker-year.active,.nc-picker-time.active',
    )
    if (activePickerOrDropdownEl) {
      e.preventDefault()
      return true
    }

    // skip keyboard event handling if there is a drawer / modal
    if (isDrawerOrModalExist()) {
      return true
    }

    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
    const altOrOptionKey = e.altKey
    if (e.key === ' ') {
      if (isCellActive.value && !editEnabled && hasEditPermission) {
        e.preventDefault()
        clearSelectedRange()
        const row = data.value[activeCell.row]
        expandForm(row)
        return true
      }
    } else if (e.key === 'Escape') {
      if (editEnabled) {
        editEnabled = false
        return true
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // add a line break for types like LongText / JSON
        return true
      }
      if (editEnabled) {
        editEnabled = false
        return true
      }
    }

    if (cmdOrCtrl) {
      if (!isCellActive.value) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = 0
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.()
          editEnabled = false
          return true
        case 'ArrowDown':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = data.value.length - 1
          activeCell.col = activeCell.col ?? 0
          scrollToCell?.()
          editEnabled = false
          return true
        case 'ArrowRight':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = fields.value?.length - 1
          scrollToCell?.()
          editEnabled = false
          return true
        case 'ArrowLeft':
          e.preventDefault()
          clearSelectedRange()
          activeCell.row = activeCell.row ?? 0
          activeCell.col = 0
          scrollToCell?.()
          editEnabled = false
          return true
      }
    }

    if (altOrOptionKey) {
      switch (e.keyCode) {
        case 82: {
          // ALT + R
          if (isAddingEmptyRowAllowed) {
            $e('c:shortcut', { key: 'ALT + R' })
            addEmptyRow()
            activeCell.row = data.value.length - 1
            activeCell.col = 0
            resetSelectedRange()
            nextTick(() => {
              ;(document.querySelector('td.cell.active') as HTMLInputElement | HTMLTextAreaElement)?.scrollIntoView({
                behavior: 'smooth',
              })
            })
          }
          break
        }
        case 67: {
          // ALT + C
          if (isAddingColumnAllowed) {
            $e('c:shortcut', { key: 'ALT + C' })
            addColumnDropdown.value = true
          }
          break
        }
      }
    }
  },
  async (ctx: { row: number; col?: number; updatedColumnTitle?: string }) => {
    const rowObj = data.value[ctx.row]
    const columnObj = ctx.col !== undefined ? fields.value[ctx.col] : null

    if (!ctx.updatedColumnTitle && isVirtualCol(columnObj)) {
      return
    }

    // update/save cell value
    await updateOrSaveRow(rowObj, ctx.updatedColumnTitle || columnObj.title)
  },
)

function scrollToCell(row?: number | null, col?: number | null) {
  row = row ?? activeCell.row
  col = col ?? activeCell.col

  if (row !== null && col !== null) {
    // get active cell
    const rows = tbodyEl.value?.querySelectorAll('tr')
    const cols = rows?.[row].querySelectorAll('td')
    const td = cols?.[col === 0 ? 0 : col + 1]

    if (!td || !gridWrapper.value) return

    const { height: headerHeight } = tableHead.value!.getBoundingClientRect()
    const tdScroll = getContainerScrollForElement(td, gridWrapper.value, { top: headerHeight, bottom: 9, right: 9 })

    if (rows && row === rows.length - 2) {
      // if last row make 'Add New Row' visible
      gridWrapper.value.scrollTo({
        top: gridWrapper.value.scrollHeight,
        left:
          cols && col === cols.length - 2 // if corner cell
            ? gridWrapper.value.scrollWidth
            : tdScroll.left,
        behavior: 'smooth',
      })
      return
    }

    if (cols && col === cols.length - 2) {
      // if last column make 'Add New Column' visible
      gridWrapper.value.scrollTo({
        top: tdScroll.top,
        left: gridWrapper.value.scrollWidth,
        behavior: 'smooth',
      })
      return
    }

    // scroll into the active cell
    gridWrapper.value.scrollTo({
      top: tdScroll.top,
      left: tdScroll.left,
      behavior: 'smooth',
    })
  }
}

const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
      default:
        return 1
    }
  }
})

onMounted(loadGridViewColumns)

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(true))

provide(PaginationDataInj, paginationData)

provide(ChangePageInj, changePage)

provide(RowHeightInj, rowHeight)

const disableUrlOverlay = ref(false)
provide(CellUrlDisableOverlayInj, disableUrlOverlay)

const showLoading = ref(true)

const skipRowRemovalOnCancel = ref(false)

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])

  if (rowId) {
    router.push({
      query: {
        ...routeQuery,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

const onresize = (colID: string, event: any) => {
  updateWidth(colID, event.detail)
}

const onXcResizing = (cn: string, event: any) => {
  resizingCol.value = cn
  resizingColWidth.value = event.detail
}

defineExpose({
  loadData,
})

// reset context menu target on hide
watch(contextMenu, () => {
  if (!contextMenu.value) {
    contextMenuTarget.value = null
  }
})

const rowRefs = $ref<any[]>()

async function clearCell(ctx: { row: number; col: number } | null, skipUpdate = false) {
  if (
    !ctx ||
    !hasEditPermission ||
    (fields.value[ctx.col].uidt !== UITypes.LinkToAnotherRecord && isVirtualCol(fields.value[ctx.col]))
  )
    return

  const rowObj = data.value[ctx.row]
  const columnObj = fields.value[ctx.col]

  if (isVirtualCol(columnObj)) {
    await rowRefs[ctx.row]!.clearLTARCell(columnObj)
    return
  }

  // handle Checkbox and rating fields in a special way
  switch (columnObj.uidt) {
    case UITypes.Checkbox:
      rowObj.row[columnObj.title] = false
      break
    case UITypes.Rating:
      rowObj.row[columnObj.title] = 0
      break
    default:
      rowObj.row[columnObj.title] = null
      break
  }

  if (!skipUpdate) {
    // update/save cell value
    await updateOrSaveRow(rowObj, columnObj.title)
  }
}

function makeEditable(row: Row, col: ColumnType) {
  if (!hasEditPermission || editEnabled || isView) {
    return
  }

  if (!isPkAvail.value && !row.rowMeta.new) {
    // Update not allowed for table which doesn't have primary Key
    message.info(t('msg.info.updateNotAllowedWithoutPK'))
    return
  }

  if (col.ai) {
    // Auto Increment field is not editable
    message.info(t('msg.info.autoIncFieldNotEditable'))
    return
  }

  if (col.pk && !row.rowMeta.new) {
    // Editing primary key not supported
    message.info(t('msg.info.editingPKnotSupported'))
    return
  }

  return (editEnabled = true)
}

/** handle keypress events */
useEventListener(document, 'keyup', async (e: KeyboardEvent) => {
  if (e.key === 'Alt') {
    disableUrlOverlay.value = false
  }
})

/** On clicking outside of table reset active cell  */
const smartTable = ref(null)

onClickOutside(tbodyEl, (e) => {
  // do nothing if context menu was open
  if (contextMenu.value) return

  if (activeCell.row === null || activeCell.col === null) return

  const activeCol = fields.value[activeCell.col]

  if (editEnabled && (isVirtualCol(activeCol) || activeCol.uidt === UITypes.JSON)) return

  // ignore unselecting if clicked inside or on the picker(Date, Time, DateTime, Year)
  // or single/multi select options
  const activePickerOrDropdownEl = document.querySelector(
    '.nc-picker-datetime.active,.nc-dropdown-single-select-cell.active,.nc-dropdown-multi-select-cell.active,.nc-picker-date.active,.nc-picker-year.active,.nc-picker-time.active',
  )
  if (
    e.target &&
    activePickerOrDropdownEl &&
    (activePickerOrDropdownEl === e.target || activePickerOrDropdownEl?.contains(e.target as Element))
  )
    return

  // skip if drawer / modal is active
  if (isDrawerOrModalExist()) {
    return
  }

  clearSelectedRange()
  activeCell.row = null
  activeCell.col = null
})

const onNavigate = (dir: NavigateDir) => {
  if (activeCell.row === null || activeCell.col === null) return

  editEnabled = false
  clearSelectedRange()

  switch (dir) {
    case NavigateDir.NEXT:
      if (activeCell.row < data.value.length - 1) {
        activeCell.row++
      } else {
        addEmptyRow()
        activeCell.row++
      }
      break
    case NavigateDir.PREV:
      if (activeCell.row > 0) {
        activeCell.row--
      }
      break
  }
}

const showContextMenu = (e: MouseEvent, target?: { row: number; col: number }) => {
  if (isSqlView.value) return
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
}

const saveOrUpdateRecords = async (args: { metaValue?: TableType; viewMetaValue?: ViewType; data?: any } = {}) => {
  let index = -1
  for (const currentRow of args.data || data.value) {
    index++
    /** if new record save row and save the LTAR cells */
    if (currentRow.rowMeta.new) {
      const syncLTARRefs = rowRefs[index]!.syncLTARRefs
      const savedRow = await updateOrSaveRow(currentRow, '', {}, args)
      await syncLTARRefs(savedRow, args)
      currentRow.rowMeta.changed = false
      continue
    }

    /** if existing row check updated cell and invoke update method */
    if (currentRow.rowMeta.changed) {
      currentRow.rowMeta.changed = false
      for (const field of (args.metaValue || meta.value)?.columns ?? []) {
        // `url` would be enriched in attachment during listing
        // hence it would consider as a change while it is not necessary to update
        if (isVirtualCol(field) || field.uidt === UITypes.Attachment) continue
        if (field.title! in currentRow.row && currentRow.row[field.title!] !== currentRow.oldRow[field.title!]) {
          await updateOrSaveRow(currentRow, field.title!, {}, args)
        }
      }
    }
  }
}

async function reloadViewDataHandler(shouldShowLoading: boolean | void) {
  // set value if spinner should be hidden
  showLoading.value = !!shouldShowLoading
  await loadData()
  // reset to default (showing spinner on load)
  showLoading.value = true
}

async function openNewRecordHandler() {
  const newRow = addEmptyRow()
  expandForm(newRow, undefined, true)
}

reloadViewDataHook?.on(reloadViewDataHandler)
openNewRecordFormHook?.on(openNewRecordHandler)

onBeforeUnmount(() => {
  /** save/update records before unmounting the component */
  saveOrUpdateRecords()

  // reset hooks
  reloadViewDataHook?.off(reloadViewDataHandler)
  openNewRecordFormHook?.off(openNewRecordHandler)
})

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!routeQuery.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...routeQuery,
          rowId: undefined,
        },
      })
  },
})

// reload table data reload hook as fallback to rowdatareload
provide(ReloadRowDataHookInj, reloadViewDataHook)

// trigger initial data load in grid
// reloadViewDataHook.trigger()

const switchingTab = ref(false)

watch(
  view,
  async (next, old) => {
    try {
      if (next && next.id !== old?.id) {
        switchingTab.value = true
        // whenever tab changes or view changes save any unsaved data
        if (old?.id) {
          const oldMeta = await getMeta(old.fk_model_id!)
          if (oldMeta) {
            await saveOrUpdateRecords({
              viewMetaValue: old,
              metaValue: oldMeta as TableType,
              data: data.value,
            })
          }
        }
        await loadData()
      }
    } catch (e) {
      console.log(e)
    } finally {
      switchingTab.value = false
    }
  },
  { immediate: true },
)

const columnOrder = ref<Pick<ColumnReqType, 'column_order'> | null>(null)

eventBus.on(async (event, payload) => {
  if (event === SmartsheetStoreEvents.FIELD_ADD) {
    columnOrder.value = payload
    addColumnDropdown.value = true
  }
})

const closeAddColumnDropdown = () => {
  columnOrder.value = null
  addColumnDropdown.value = false
}

function isEmpty (v: any) {
  return v === undefined || v === null || v === ""
}
function coerceEmpty(v: any) {
  return isEmpty(v) ? "(Empty)" : v
}
</script>

<template>
  <div class="relative flex flex-col h-full min-h-0 w-full" data-testid="nc-grid-wrapper">
    <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15" data-testid="grid-load-spinner">
      <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>

    <div ref="gridWrapper" :class="{ grouped: isGrouping }" class="nc-grid-wrapper min-h-0 flex-1 scrollbar-thin-dull">
      <a-dropdown
        v-model:visible="contextMenu"
        :trigger="isSqlView ? [] : ['contextmenu']"
        overlay-class-name="nc-dropdown-grid-context-menu"
      >
        <table
          ref="smartTable"
          class="xc-row-table nc-grid backgroundColorDefault !h-auto bg-white"
          @contextmenu="showContextMenu"
        >
          <thead ref="tableHead">
            <tr class="nc-grid-header">
              <th class="w-[80px] min-w-[80px]" data-testid="grid-id-column">
                <div class="w-full h-full bg-gray-100 flex pl-5 pr-1 items-center" data-testid="nc-check-all">
                  <template v-if="!readOnly">
                    <div class="nc-no-label text-gray-500" :class="{ hidden: selectedAllRecords }">#</div>
                    <div
                      :class="{ hidden: !selectedAllRecords, flex: selectedAllRecords }"
                      class="nc-check-all w-full items-center"
                    >
                      <a-checkbox v-model:checked="selectedAllRecords" />

                      <span class="flex-1" />
                    </div>
                  </template>
                  <template v-else>
                    <div class="text-gray-500">#</div>
                  </template>
                </div>
              </th>
              <th
                v-for="col in fields"
                :key="col.title"
                v-xc-ver-resize
                :data-col="col.id"
                :data-title="col.title"
                @xcresize="onresize(col.id, $event)"
                @xcresizing="onXcResizing(col.title, $event)"
                @xcresized="resizingCol = null"
              >
                <div class="w-full h-full bg-gray-100 flex items-center">
                  <LazySmartsheetHeaderVirtualCell v-if="isVirtualCol(col)" :column="col" :hide-menu="readOnly" />

                  <LazySmartsheetHeaderCell v-else :column="col" :hide-menu="readOnly" />
                </div>
              </th>
              <th
                v-if="isAddingColumnAllowed"
                v-e="['c:column:add']"
                class="cursor-pointer"
                @click.stop="addColumnDropdown = true"
              >
                <a-dropdown
                  v-model:visible="addColumnDropdown"
                  :trigger="['click']"
                  overlay-class-name="nc-dropdown-grid-add-column"
                >
                  <div class="h-full w-[60px] flex items-center justify-center">
                    <component :is="iconMap.plus" class="text-sm nc-column-add" />
                  </div>

                  <template #overlay>
                    <SmartsheetColumnEditOrAddProvider
                      v-if="addColumnDropdown"
                      :column-position="columnOrder"
                      @submit="closeAddColumnDropdown"
                      @cancel="closeAddColumnDropdown"
                      @click.stop
                      @keydown.stop
                    />
                  </template>
                </a-dropdown>
              </th>
            </tr>
          </thead>
          <tbody ref="tbodyEl">
            <LazySmartsheetRow v-for="(row, rowIndex) of viewData" ref="rowRefs" :key="rowIndex" :row="row">
              <template #default="{ state }">
                <tr v-if="isGrouping" class="group-end" v-for="{groupIndex, groupValue, rowIndex } in row.groupsEnded">
                  <td></td>
                  <td>
                    <div class="flex">                      
                      <template v-for="spacerOffset in ((groupIndex + 1))">
                        <div class="grouping-spacer h-full" :class="{ end: spacerOffset===(groupIndex+1) }">
                          <!-- {{ `${spacerOffset},${groupOffset}` }} -->
                          <!-- {{ groupIndex }} -->
                        </div>
                      </template>                      
                      
                      <div class="grouping-cell-body flex-1"/>
                    </div>
                  </td>
                  <td :colspan="visibleColLength - 1">
                    <!-- end {{ groupIndex }}  {{ data[rowIndex][groupFields[groupIndex]!.field.title!] }} {{  groupValue }} from row {{  rowIndex }} -->
                  </td>
                </tr>

                <template v-if="isGrouping" v-for="groupIndex in row.groupsStarting">
                  <tr class="group-begin">
                    <td></td>
                    <td>
                      <div class="flex">
                        <div class="grouping-spacer" v-for="offset in groupIndex">
                          <!-- {{ offset }} -->
                        </div>
                      </div>
                    </td>
                    <td :colspan="visibleColLength - 1">
                      <!-- begin {{ groupIndex }} {{ row.row[groupFields[groupIndex]!.field.title!] }} -->
                    </td>
                  </tr>                
                  <tr class="nc-group-row">
                    <td><div></div></td>
                    <td>
                      <div class="grouping-cell-container flex">
                        <!-- {{ row.row[groupName] }} -->
                        <div class="grouping-spacer" v-for="index in groupIndex" />
                        <div v-if="!switchingTab" class="grouping-cell-body w-full h-full" :set="columnObj = groupFields[groupIndex].field">
                          <div class="text-gray-500 text-[9px] uppercase font-bold pl-1">
                            {{columnObj.title}}
                          </div>
                          <!-- <span v-if="isEmpty(row.row[columnObj.title])">(Empty)</span> -->
                          <LazySmartsheetVirtualCell
                            v-if="isVirtualCol(columnObj)"
                            :modelValue="coerceEmpty(row.row[columnObj.title])"
                            :column="columnObj"
                            :row="row"
                            :read-only="true"
                            @navigate="onNavigate"
                            @save="updateOrSaveRow(row, '', state)"
                          />

                          <LazySmartsheetCell
                            v-else
                            :modelValue="coerceEmpty(row.row[columnObj.title])"
                            :column="columnObj"
                            :row-index="rowIndex"
                            :read-only="true"
                            @update:edit-enabled="editEnabled = $event"
                            @save="updateOrSaveRow(row, columnObj.title, state)"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                          />
                        </div>                      
                      </div>
                    </td>
                    <td v-for="offset of fields.length-1"
                      :key="offset">
                      <div class="grouping-cell-body">
                        <!-- soon: stats                 -->
                      </div>
                    </td>
                  </tr>
                </template>       
                
                <tr
                  class="nc-grid-row"
                  :style="{ height: rowHeight ? `${rowHeight * 1.5}rem` : `1.5rem` }"                  
                  :data-testid="`grid-row-${rowIndex}`"
                >
                  <td key="row-index" class="caption nc-grid-cell pl-5 pr-1" :data-testid="`cell-Id-${rowIndex}`">
                    <div class="items-center flex gap-1 min-w-[55px] h-full">
                      <div
                        v-if="!readOnly || !isLocked"
                        class="nc-row-no text-xs text-gray-500"
                        :class="{ toggle: !readOnly, hidden: row.rowMeta.selected }"
                      >
                        {{ ((paginationData.page ?? 1) - 1) * (paginationData.pageSize ?? 25) + rowIndex + 1 }}
                      </div>
                      <div
                        v-if="!readOnly"
                        :class="{ hidden: !row.rowMeta.selected, flex: row.rowMeta.selected }"
                        class="nc-row-expand-and-checkbox"
                      >
                        <a-checkbox v-model:checked="row.rowMeta.selected" />
                      </div>
                      <span class="flex-1" />

                      <div
                        v-if="!readOnly || hasRole('commenter', true) || hasRole('viewer', true)"
                        class="nc-expand"
                        :data-testid="`nc-expand-${rowIndex}`"
                        :class="{ 'nc-comment': row.rowMeta?.commentCount }"
                      >
                        <a-spin
                          v-if="row.rowMeta.saving"
                          class="!flex items-center"
                          :data-testid="`row-save-spinner-${rowIndex}`"
                        />
                        <template v-else>
                          <span
                            v-if="row.rowMeta?.commentCount"
                            class="py-1 px-3 rounded-full text-xs cursor-pointer select-none transform hover:(scale-110)"
                            :style="{ backgroundColor: enumColor.light[row.rowMeta.commentCount % enumColor.light.length] }"
                            @click="expandForm(row, state)"
                          >
                            {{ row.rowMeta.commentCount }}
                          </span>
                          <div
                            v-else
                            class="cursor-pointer flex items-center border-1 active:ring rounded p-1 hover:(bg-primary bg-opacity-10)"
                          >
                            <component
                              :is="iconMap.expand"
                              v-e="['c:row-expand']"
                              class="select-none transform hover:(text-accent scale-120) nc-row-expand"
                              @click="expandForm(row, state)"
                            />
                          </div>
                        </template>
                      </div>
                    </div>
                  </td>
                  <SmartsheetTableDataCell
                    v-for="(columnObj, colIndex) of fields"
                    :key="columnObj.id"
                    class="cell relative cursor-pointer nc-grid-cell"
                    :class="{
                      'active': hasEditPermission && isCellSelected(rowIndex, colIndex),
                      'nc-required-cell': isColumnRequiredAndNull(columnObj, row.row),
                      'align-middle': !rowHeight || rowHeight === 1,
                      'align-top': rowHeight && rowHeight !== 1,
                    }"
                    :data-testid="`cell-${columnObj.title}-${rowIndex}`"
                    :data-key="rowIndex + columnObj.id"
                    :data-col="columnObj.id"
                    :data-title="columnObj.title"
                    @mousedown="handleMouseDown($event, rowIndex, colIndex)"
                    @mouseover="handleMouseOver(rowIndex, colIndex)"
                    @click="handleCellClick($event, rowIndex, colIndex)"
                    @dblclick="makeEditable(row, columnObj)"
                    @contextmenu="showContextMenu($event, { row: rowIndex, col: colIndex })"
                  >
                    <div class="flex">
                      <template v-if="isGrouping && colIndex === 0" v-for="index in groupCount - 1">
                        <div class="grouping-spacer h-full" :class="{ end: row.groupsEnded.includes(index) }" />
                      </template>
                      <div v-if="!switchingTab" class="cell-body h-full flex-1 flex items-center px-2">
                        <div>                          
                          <LazySmartsheetVirtualCell
                            v-if="isVirtualCol(columnObj)"
                            v-model="row.row[columnObj.title]"
                            :column="columnObj"
                            :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                            :row="row"
                            :read-only="readOnly"
                            @navigate="onNavigate"
                            @save="updateOrSaveRow(row, '', state)"
                          />
    
                          <LazySmartsheetCell
                            v-else
                            v-model="row.row[columnObj.title]"
                            :column="columnObj"
                            :edit-enabled="
                              !!hasEditPermission && !!editEnabled && activeCell.col === colIndex && activeCell.row === rowIndex
                            "
                            :row-index="rowIndex"
                            :active="activeCell.col === colIndex && activeCell.row === rowIndex"
                            :read-only="readOnly"
                            @update:edit-enabled="editEnabled = $event"
                            @save="updateOrSaveRow(row, columnObj.title, state)"
                            @navigate="onNavigate"
                            @cancel="editEnabled = false"
                          />
                        </div>
                      </div>
                    </div>
                  </SmartsheetTableDataCell>
                </tr>
         
                <tr v-if="isGrouping && rowIndex === finalRowIndex" class="group-end final" v-for="groupOffset in groupFields.length-1">
                  <td></td>
                  <td>
                    <div class="flex">                      
                      <template v-for="spacerOffset in (groupCount - groupOffset)">
                        <div class="grouping-spacer h-full" :class="{ end: spacerOffset===(groupCount-groupOffset) }">
                          <!-- {{ `${spacerOffset},${groupOffset}` }} -->
                        </div>
                      </template>
                      
                      <div class="grouping-cell-body flex-1"/>
                    </div>
                  </td>
                  <td :colspan="visibleColLength - 1">
                    <!-- end {{ groupIndex }}  {{ data[rowIndex][groupFields[groupIndex]!.field.title!] }} {{  groupValue }} from row {{  rowIndex }} -->
                  </td>
                </tr>                
              </template>
            </LazySmartsheetRow>

            <tr v-if="isAddingEmptyRowAllowed">
              <td
                v-e="['c:row:add:grid-bottom']"
                :colspan="visibleColLength + 1"
                class="text-left pointer nc-grid-add-new-cell cursor-pointer"
                @click="addEmptyRow()"
              >
                <div class="px-2 w-full flex items-center text-gray-500">
                  <component :is="iconMap.plus" class="text-pint-500 text-xs ml-2 text-primary" />

                  <span class="ml-1">
                    {{ $t('activity.addRow') }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <template v-if="!isLocked && hasEditPermission" #overlay>
          <a-menu class="shadow !rounded !py-0" @click="contextMenu = false">
            <a-menu-item v-if="contextMenuTarget" @click="deleteRow(contextMenuTarget.row)">
              <div v-e="['a:row:delete']" class="nc-project-menu-item">
                <!-- Delete Row -->
                {{ $t('activity.deleteRow') }}
              </div>
            </a-menu-item>

            <a-menu-item @click="deleteSelectedRows">
              <div v-e="['a:row:delete-bulk']" class="nc-project-menu-item">
                <!-- Delete Selected Rows -->
                {{ $t('activity.deleteSelectedRow') }}
              </div>
            </a-menu-item>

            <!--            Clear cell -->
            <a-menu-item
              v-if="
                contextMenuTarget &&
                (fields[contextMenuTarget.col].uidt === UITypes.LinkToAnotherRecord ||
                  !isVirtualCol(fields[contextMenuTarget.col]))
              "
              @click="clearCell(contextMenuTarget)"
            >
              <div v-e="['a:row:clear']" class="nc-project-menu-item">{{ $t('activity.clearCell') }}</div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget" @click="addEmptyRow(contextMenuTarget.row + 1)">
              <div v-e="['a:row:insert']" class="nc-project-menu-item">
                <!-- Insert New Row -->
                {{ $t('activity.insertRow') }}
              </div>
            </a-menu-item>

            <a-menu-item v-if="contextMenuTarget" data-testid="context-menu-item-copy" @click="copyValue(contextMenuTarget)">
              <div v-e="['a:row:copy']" class="nc-project-menu-item">
                <!-- Copy -->
                {{ $t('general.copy') }}
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <LazySmartsheetPagination />

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="expandedFormRow"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
        @update:model-value="!skipRowRemovalOnCancel && removeRowIfNew(expandedFormRow)"
      />
    </Suspense>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormOnRowIdDlg"
        :key="routeQuery.rowId"
        v-model="expandedFormOnRowIdDlg"
        :row="{ row: {}, oldRow: {}, rowMeta: {} }"
        :meta="meta"
        :row-id="routeQuery.rowId"
        :view="view"
        show-next-prev-icons
        :first-row="getExpandedRowIndex() === 0"
        :last-row="getExpandedRowIndex() === data.length - 1"
        @next="navigateToSiblingRow(NavigateDir.NEXT)"
        @prev="navigateToSiblingRow(NavigateDir.PREV)"
      />
    </Suspense>
  </div>
</template>

<style scoped lang="scss">


.nc-grid-wrapper {
  --table-spacing: 14px;

  @apply h-full w-full overflow-auto;

  td,
  th {
    @apply border-gray-200 border-solid border-b border-r;
    min-height: 41px !important;
    height: 41px !important;
    position: relative;
  }

  th {
    @apply bg-gray-100;
  }

  td:not(:first-child) > div {
    overflow: hidden;
    @apply flex px-1 h-auto;
  }

  table {
    border-collapse: separate;
    border-spacing: 0;
  }

  td {
    text-overflow: ellipsis;
  }

  td.active::after {
    content: '';
    position: absolute;
    z-index: 3;
    height: calc(100% + 2px);
    width: calc(100% + 2px);
    left: -1px;
    top: -1px;
    pointer-events: none;
  }

  // todo: replace with css variable
  td.active::after {
    @apply border-1 border-solid text-primary border-current bg-primary bg-opacity-5;
  }

  //td.active::before {
  //  content: '';
  //  z-index:4;
  //  @apply absolute !w-[10px] !h-[10px] !right-[-5px] !bottom-[-5px] bg-primary;
  //}

  thead th:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 5;
  }

  tbody td:nth-child(1) {
    position: sticky !important;
    left: 0;
    z-index: 4;
    background: white;
  }

  thead th:nth-child(2) {
    position: sticky !important;
    left: 80px;
    z-index: 5;
    @apply border-r-2 border-r-gray-300;
  }

  tbody td:nth-child(2) {
    position: sticky !important;
    left: 80px;
    z-index: 4;
    background: white;
    @apply border-r-2 border-r-gray-300;
  }

  &.grouped {
    background-color: lightblue;

    .grouping-spacer {
      // background: lightgoldenrodyellow;
      width: var(--table-spacing);
      @apply border-gray-200 border-solid border-l;
      flex-shrink: 0;
      &.end {
        // background: pink;
        // border-bottom: solid 1px #ccc;
        @apply border-b
      }
    }
    :where(td,th):where(:first-child, :nth-child(2)) {
      border-width: 0;
      padding: 0;
    }
    td:first-child {
      // border-right: 1px solid #ccc;
    }

    .nc-group-row {
      td {
        padding: 0;
      }
      .grouping-cell-body {        
        @apply bg-gray-200       
      }
    }
    .grouping-cell-container {
      .grouping-cell-body {
        @apply rounded-tl;
        height: 100%;
        @apply p-2
      }
    }

    td:nth-child(2) > div {
      padding: 0;
      height: 100%;
    }

    td:nth-child(2) .cell-body {
      /* background: pink; */
      border-bottom: 1px solid #e1e4e8;
      
      // @apply border-r-1 border-r-gray-300;

      border-left: 1px solid #e1e4e8;
      1px solid #E1E4E8
    }

    td:nth-child(2).active::after {
      content: '';
      position: absolute;
      z-index: 3;
      height: calc(100% + 2px);
      width: calc(100% + 2px);
      left: -1px;
      top: -1px;
      pointer-events: none;
      display: none;
    }
    td:nth-child(2).active .cell-body {
      background: lightgreen;
      position: relative;
    }
    td:nth-child(2).active .cell-body::after {
      content: '';
      position: absolute;
      z-index: 3;
      height: 100%;
      width: 100%;
      left: 0;
      top: 0;
      pointer-events: none;
      // display: none;
    }

    .grouping-cell-body {      
      height: 100%;
      // border: solid 1px #ccc;
    }

    td:nth-child(2).active .cell-body::after {
      @apply border-1 border-solid text-primary border-current bg-primary bg-opacity-5;
    }
    

    td:nth-child(2) .grouping-cell-body {
      border-right-width: 1px;
      border-bottom-width: 1px;
      border-color: rgba(229, 231, 235, var(--tw-border-opacity));
    }

    tr.group-begin, tr.group-end {
      th, td {
        height: var(--table-spacing) !important;
      }      
      :where(td,th):nth-child(2) {       
        border-right-width: 0;
        border-bottom-width: 0;
      }
    }
    // tr.group-separator {
    //   th, td {
    //     height: 12px !important;
    //   }
    // }
    tr.group-end {
      // background: rgba(200,0,0,0.2);
      // .grouping-spacer:last-of-type {
      //   background-color: green;
      //   border-bottom: solid 1px ;
      // }
      td {
        border-width: 0;
        border-bottom-width: 1px;
        .grouping-cell-body {
          border-right-width: 0;
        }
      }
      // .grouping-spacer {
      //   border-bottom-width: 1px;
      // }
      td:first-child {
        border-bottom-width: 0;
      }
      :where(td,th):where(:first-child, :nth-child(2)) {
        border-width: 0;
        padding: 0;
        
      }
      &.final {
        .grouping-spacer {
          border-bottom-width: 0;
        }
        .end {
          // background-color: pink;
          @apply border-gray-200 border-solid border-b;
        }
        // td:where(:nth-child(2), :last-child) {
        //   @apply border-gray-200 border-solid border-l border-r;
        // }
        // .grouping-spacer {
        //   border-left-width: 0;
        // }
        // .grouping-spacer:first-child {
        //   border-left-width: 1px;;
        // }
      }
    }
    tr.group-begin {
      td {
        border-bottom-width: 0;
        border-right-width: 0;
      }
      // background: rgba(0,200,0,0.2);
      :where(td,th):nth-child(1) {
        border-width: 0;
      }
      :where(td,th):nth-child(2) {        
        // border-bottom-width: 1px;        
      }
    }
  }

}

:deep {
  .resizer:hover,
  .resizer:active,
  .resizer:focus {
    // todo: replace with primary color
    @apply bg-blue-500/50;
    cursor: col-resize;
  }
}

.nc-grid-row {
  .nc-row-expand-and-checkbox {
    @apply w-full items-center justify-between;
  }

  .nc-expand {
    &:not(.nc-comment) {
      @apply hidden;
    }

    &.nc-comment {
      display: flex;
    }
  }

  &:hover {
    .nc-row-no.toggle {
      @apply hidden;
    }

    .nc-expand {
      @apply flex;
    }

    .nc-row-expand-and-checkbox {
      @apply flex;
    }
  }
}

.nc-grid-header {
  position: sticky;
  top: -1px;

  @apply z-10 bg-gray-100;

  &:hover {
    .nc-no-label {
      @apply hidden;
    }

    .nc-check-all {
      @apply flex;
    }
  }
}

tbody tr:hover {
  @apply bg-gray-100 bg-opacity-50;
}

.nc-required-cell {
  box-shadow: inset 0 0 2px #f00;
}
</style>
