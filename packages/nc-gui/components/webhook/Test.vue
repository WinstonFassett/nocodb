<script setup lang="ts">
import type { HookTestReqType, HookType } from 'nocodb-sdk'
import { MetaInj, extractSdkResponseErrorMsg, inject, message, onMounted, ref, useI18n, useNuxtApp, watch } from '#imports'

interface Props {
  hook: HookType
}

const { hook } = defineProps<Props>()

const { t } = useI18n()

const { $api } = useNuxtApp()

const meta = inject(MetaInj, ref())

const sampleData = ref({
  data: {},
})
const activeKey = ref(0)

watch(
  () => hook?.operation,
  async () => {
    await loadSampleData()
  },
)

async function loadSampleData() {
  sampleData.value = {
    data: await $api.dbTableWebhook.samplePayloadGet(meta?.value?.id as string, hook?.operation || 'insert'),
  }
}

async function testWebhook() {
  try {
    await $api.dbTableWebhook.test(
      meta.value?.id as string,
      {
        hook,
        payload: sampleData.value,
      } as HookTestReqType,
    )

    // Webhook tested successfully
    message.success(t('msg.success.webhookTested'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

defineExpose({
  testWebhook,
})

onMounted(async () => {
  await loadSampleData()
})
</script>

<template>
  <a-collapse v-model:activeKey="activeKey" ghost>
    <a-collapse-panel key="1" header="Sample Payload">
      <LazyMonacoEditor v-model="sampleData" class="min-h-60 max-h-80" />
    </a-collapse-panel>
  </a-collapse>
</template>
