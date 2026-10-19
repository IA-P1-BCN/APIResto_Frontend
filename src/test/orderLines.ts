export function lineText(li: HTMLElement): string | null {
  const copy = li.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.quantity').forEach((counter) => counter.remove())
  return copy.textContent
}
