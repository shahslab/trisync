// The app is laid out for a fixed scale, so zooming only breaks it. The viewport tag and
// CSS touch-action in public/index.html stop most browsers; these cover the rest.
const block = (event) => event.preventDefault()

// iOS Safari ignores user-scalable=no, but its pinch gestures can be cancelled
document.addEventListener('gesturestart', block)
document.addEventListener('gesturechange', block)
document.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1) event.preventDefault()
}, { passive: false })

// Desktop: ctrl/⌘ + scroll wheel or trackpad pinch, and ctrl/⌘ with + - = 0
document.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey) event.preventDefault()
}, { passive: false })
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault()
})
