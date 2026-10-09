/**
 * 工作台阻断提示：模态弹窗 + 可执行恢复路径。
 *
 * 依据：`docs/standards/WEB-工作台设计构建规范.md` §5.1 阻断提示规范（强制）。
 * 约定：
 * - 前置条件不满足属于“阻断”，必须用模态弹窗，禁止只写页面底部内联提示；
 * - 必须给出恢复路径（actionText + onAction），不能只给“知道了”；
 * - Element Plus 由 unplugin 按需自动引入（含样式），禁止整库导入。
 */

export interface BlockedNoticeOptions {
  /** 弹窗标题，用使用者语言，例如「还不能预约量房」。 */
  title: string
  /** 阻断原因与恢复说明：说明哪个对象、缺什么、做完什么才能继续。 */
  message: string
  /** 恢复动作文案，例如「去写跟进」「建立房屋」；不传则只有「知道了」。 */
  actionText?: string
  /** 点击恢复动作后的回调。 */
  onAction?: () => void
  /** 取消文案，默认「稍后再说」，仅在有恢复动作时展示。 */
  cancelText?: string
}

/** 弹出阻断提示；用户取消时静默返回，不阻断页面其余操作。 */
export function notifyBlocked(options: BlockedNoticeOptions): void {
  const showCancel = Boolean(options.actionText)
  void ElMessageBox.confirm(options.message, options.title, {
    type: 'warning',
    confirmButtonText: options.actionText || '知道了',
    cancelButtonText: showCancel ? (options.cancelText || '稍后再说') : undefined,
    showCancelButton: showCancel,
    closeOnClickModal: false,
    customClass: 'fu-block-dialog'
  }).then(() => {
    options.onAction?.()
  }).catch(() => {
    // 用户选择稍后再说：保留当前上下文。
  })
}
