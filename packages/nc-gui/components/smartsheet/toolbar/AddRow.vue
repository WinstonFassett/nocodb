<script setup lang="ts">
import { IsLockedInj, OpenNewRecordFormHookInj, iconMap, inject } from '#imports'

const isLocked = inject(IsLockedInj)

const openNewRecordFormHook = inject(OpenNewRecordFormHookInj)!

const onClick = () => {
  if (!isLocked?.value) openNewRecordFormHook.trigger()
}
</script>

<template>
  <a-tooltip placement="bottom">
    <template #title> {{ $t('activity.addRow') }} </template>
    <IonImageOutline />
    <div
      v-e="['c:row:add:grid-top']"
      :class="{ 'group': !isLocked, 'disabled-ring': isLocked }"
      class="nc-add-new-row-btn nc-toolbar-btn flex min-w-32px w-32px h-32px items-center justify-center !px-0 select-none"
    >
      <component
        :is="iconMap.plus"
        :class="{ 'cursor-pointer group-hover:(text-primary)': !isLocked, 'disabled': isLocked }"
        @click="onClick"
      />
    </div>
  </a-tooltip>
</template>
