import Link from 'next/link'

/**
 * 404 no tema do sistema (a padrão do Next usava system-ui, fora do design).
 * Herdando o layout raiz, já vem com Archivo e os tokens de cor.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <p className="rotulo-mono">Erro 404</p>
        <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          O endereço não existe no ColetivoSend. Para enviar arquivos, use a página inicial; os envios feitos ficam em &ldquo;Meus envios&rdquo;.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Link href="/" className="btn btn-primary">Enviar arquivos</Link>
          <Link href="/dashboard" className="btn btn-secondary">Meus envios</Link>
        </div>
      </div>
    </main>
  )
}
