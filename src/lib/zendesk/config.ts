// 4社のZendesk設定を環境変数から読み込む
export interface ZendeskSourceConfig {
  key: string;
  name: string;
  subdomain: string;
  email: string;
  token: string;
  inquiryFieldId?: number;
  statusFieldId?: number;
  ccFieldId?: number;
}

export function getZendeskSources(): ZendeskSourceConfig[] {
  const sources: ZendeskSourceConfig[] = [];
  for (let i = 1; i <= 4; i++) {
    const subdomain = process.env[`ZENDESK_${i}_SUBDOMAIN`];
    const email = process.env[`ZENDESK_${i}_USER_EMAIL`];
    const token = process.env[`ZENDESK_${i}_API_TOKEN`];
    const name = process.env[`ZENDESK_${i}_NAME`] ?? `インスタンス${i}`;
    if (subdomain && email && token) {
      const inquiryFieldId = parseInt(process.env[`ZENDESK_${i}_INQUIRY_FIELD_ID`] ?? '0', 10);
      const statusFieldId = parseInt(process.env[`ZENDESK_${i}_STATUS_FIELD_ID`] ?? '0', 10);
      const ccFieldId = parseInt(process.env[`ZENDESK_${i}_CC_FIELD_ID`] ?? '0', 10);
      sources.push({ key: subdomain, name, subdomain, email, token, inquiryFieldId: inquiryFieldId || undefined, statusFieldId: statusFieldId || undefined, ccFieldId: ccFieldId || undefined });
    }
  }
  return sources;
}
