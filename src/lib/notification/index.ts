// Notification dispatcher module
export {
  formatNotificationMessage,
  formatPlainTextMessage,
  generateTicketUrl,
  type FormatNotificationInput,
} from './message-formatter';

export {
  NotificationDispatcher,
  retryWithBackoff,
  type NotificationDispatcherDeps,
  type NotificationChannelAdapters,
  type FormattedMessage,
  type SendResult,
} from './dispatcher';

export {
  NotificationRuleManager,
  createInMemoryRuleStore,
  type NotificationRuleStore,
  type CreateNotificationRuleInput,
  type UpdateNotificationRuleInput,
} from './rule-manager';
