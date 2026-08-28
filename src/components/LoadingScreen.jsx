export default function LoadingScreen({ progress = 0, label = 'Carregando dados...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-dark-500" />
        <div
          className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
      </div>
      <p className="text-muted text-sm font-medium">{label}</p>
      {progress > 0 && (
        <div className="w-64 h-1.5 bg-dark-500 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {progress > 0 && (
        <span className="text-muted text-xs font-mono">{progress}%</span>
      )}
    </div>
  )
}
