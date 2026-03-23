import { useEffect, useRef } from 'react'

export default function LineChart({ data = [], color = '#00d4ff', width = 600, height = 200 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.length) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const pad = { top: 20, right: 20, bottom: 30, left: 40 }
    const iW = W - pad.left - pad.right
    const iH = H - pad.top  - pad.bottom

    ctx.clearRect(0, 0, W, H)

    const values = data.map(d => d.value)
    const min = Math.min(...values) * 0.92
    const max = Math.max(...values) * 1.08

    // Grid lines
    ctx.strokeStyle = 'rgba(0,212,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (iH / 4) * i
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke()
    }

    // X labels
    ctx.fillStyle = '#4a6080'
    ctx.font = '11px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    data.forEach((d, i) => {
      const x = pad.left + (iW / (data.length - 1)) * i
      ctx.fillText(d.label, x, H - 8)
    })

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom)
    grad.addColorStop(0, color + '30')
    grad.addColorStop(1, color + '00')
    ctx.fillStyle = grad
    ctx.beginPath()
    data.forEach((d, i) => {
      const x = pad.left + (iW / (data.length - 1)) * i
      const y = pad.top + iH - ((d.value - min) / (max - min)) * iH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.lineTo(pad.left + iW, H - pad.bottom)
    ctx.lineTo(pad.left, H - pad.bottom)
    ctx.closePath(); ctx.fill()

    // Line
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    data.forEach((d, i) => {
      const x = pad.left + (iW / (data.length - 1)) * i
      const y = pad.top + iH - ((d.value - min) / (max - min)) * iH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Dots
    data.forEach((d, i) => {
      const x = pad.left + (iW / (data.length - 1)) * i
      const y = pad.top + iH - ((d.value - min) / (max - min)) * iH
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#060b18'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [data, color])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      id="trend-canvas"
      style={{ width: '100%', height: 'auto' }}
    />
  )
}
