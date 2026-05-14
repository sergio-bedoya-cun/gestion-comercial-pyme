export default function KPICard({ titulo, valor, subtitulo, color = 'blue', icono }) {
  const colores = {
    blue:   'bg-blue-50  border-blue-200  text-blue-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    red:    'bg-red-50   border-red-200   text-red-700',
  }

  return (
    <div className={`rounded-xl border-2 p-6 ${colores[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-3xl">{icono}</span>
      </div>
      <p className="text-2xl font-bold">{valor}</p>
      <p className="font-semibold mt-1">{titulo}</p>
      {subtitulo && <p className="text-sm opacity-70 mt-1">{subtitulo}</p>}
    </div>
  )
}