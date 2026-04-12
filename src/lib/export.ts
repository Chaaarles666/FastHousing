export function getExportErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("tainted") || message.includes("cross-origin") || message.includes("cors")) {
      return "导出失败：页面里有跨域资源，浏览器阻止了截图，请稍后重试。";
    }

    if (message.includes("memory") || message.includes("allocation")) {
      return "导出失败：内存不足，建议减少内容后重试。";
    }

    if (message.includes("timeout")) {
      return "导出失败：渲染超时，请刷新页面后重试。";
    }

    return `导出失败：${error.message}`;
  }

  return fallback;
}
