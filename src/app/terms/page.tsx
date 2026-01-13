'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { FileText, AlertTriangle, Scale, Clock, Ban, ArrowUp } from 'lucide-react'

export default function TermsPage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const sections = [
    { id: 'acceptance', label: 'Aceitação' },
    { id: 'usage', label: 'Regras de Uso' },
    { id: 'prohibited', label: 'Conteúdo Proibido' },
    { id: 'limits', label: 'Planos e Limites' },
    { id: 'expiration', label: 'Expiração e Deleção' },
    { id: 'liability', label: 'Responsabilidades' },
    { id: 'termination', label: 'Encerramento' },
    { id: 'abuse', label: 'Denúncias' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-bold text-xl text-foreground">
            Coletivo<span className="text-primary-500">Send</span>
          </a>
          <a href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Voltar ao início
          </a>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Title Area */}
          <div className="mb-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-primary-500" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Termos de Uso
              </h1>
              <p className="text-lg text-surface-500 max-w-2xl mx-auto">
                Leia com atenção para entender seus direitos e deveres ao usar o ColetivoSend.
              </p>
              <p className="text-sm text-surface-400 mt-4">
                Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </motion.div>
          </div>

          <div className="flex flex-col md:flex-row gap-12">
            {/* Sidebar / TOC */}
            <aside className="hidden md:block w-64 flex-shrink-0">
              <div className="sticky top-32 space-y-1">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4 px-2">
                  Índice
                </p>
                {sections.map(section => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="block w-full text-left px-2 py-1.5 text-sm text-surface-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </aside>

            {/* Content */}
            <article className="flex-1 prose prose-slate prose-headings:scroll-mt-32 max-w-none">

              <section id="acceptance" className="mb-12">
                <h2>1. Aceitação dos Termos</h2>
                <p>
                  Ao acessar ou utilizar o ColetivoSend, você concorda em cumprir estes Termos de Uso.
                  Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                </p>
              </section>

              <section id="usage" className="mb-12">
                <h2>2. Regras de Uso</h2>
                <p>
                  O ColetivoSend é uma plataforma para transferência temporária de arquivos. Você concorda em usar o serviço apenas para fins legais e de acordo com todas as leis aplicáveis.
                </p>
                <p>Você é o único responsável por:</p>
                <ul>
                  <li>Todo o conteúdo que você envia ou compartilha;</li>
                  <li>Manter a confidencialidade de suas senhas e links de acesso;</li>
                  <li>Garantir que possui os direitos autorais ou permissões necessárias para compartilhar os arquivos.</li>
                </ul>
              </section>

              <section id="prohibited" className="mb-12">
                <h2>3. Conteúdo Proibido</h2>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl not-prose mb-4">
                  <div className="flex items-center gap-2 font-semibold text-red-800 mb-2">
                    <Ban className="w-5 h-5" />
                    Tolerância Zero
                  </div>
                  <p className="text-sm text-red-700">
                    O envio de qualquer conteúdo relacionado a abuso infantil, exploração sexual, terrorismo ou malware resultará no banimento imediato e denúncia às autoridades competentes.
                  </p>
                </div>
                <p>É estritamente proibido enviar ou compartilhar:</p>
                <ul>
                  <li>Material ilegal, difamatório, obsceno ou ofensivo;</li>
                  <li>Vírus, trojans, worms ou qualquer código malicioso;</li>
                  <li>Conteúdo que viole direitos autorais, marcas registradas ou propriedade intelectual;</li>
                  <li>Spam ou correntes.</li>
                </ul>
              </section>

              <section id="limits" className="mb-12">
                <h2>4. Planos e Limites</h2>
                <p>
                  O ColetivoSend opera atualmente sob um plano gratuito unificado (Free), que exige cadastro para garantir a segurança e a rastreabilidade dos envios. Os limites são:
                </p>
                <ul>
                  <li>
                    <strong>Tamanho por Transferência:</strong> Até 10 GB (total dos arquivos).
                  </li>
                  <li>
                    <strong>Quantidade de Arquivos:</strong> Ilimitada, respeitando o tamanho total máximo.
                  </li>
                  <li>
                    <strong>Limite de Uso:</strong> Máximo de 15 transferências a cada 30 dias (rolling window).
                  </li>
                  <li>
                    <strong>Validade dos Links:</strong> Opções de 1 hora, 1 dia, 7 dias ou 30 dias.
                  </li>
                </ul>
                <p>Reservamo-nos o direito de alterar estes limites a qualquer momento, visando a sustentabilidade do serviço.</p>
              </section>

              <section id="expiration" className="mb-12">
                <h2>5. Expiração e Deleção</h2>
                <p>
                  <strong>O ColetivoSend não é um serviço de armazenamento em nuvem (backup).</strong>
                </p>
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200 not-prose">
                  <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Todos os arquivos têm data de validade. Após a expiração, o conteúdo é <strong>automaticamente e irreversivelmente deletado</strong> de nossos servidores. Não nos responsabilizamos por perdas de arquivos que não foram baixados dentro do prazo.
                  </p>
                </div>
              </section>

              <section id="liability" className="mb-12">
                <h2>6. Limitação de Responsabilidade</h2>
                <p>
                  O serviço é fornecido &quot;como está&quot; e &quot;conforme disponibilidade&quot;. O ColetivoSend não garante que o serviço será ininterrupto ou livre de erros.
                  Em nenhuma circunstância seremos responsáveis por danos diretos, indiretos, incidentais ou perda de dados decorrentes do uso ou incapacidade de usar o serviço.
                </p>
              </section>

              <section id="termination" className="mb-12">
                <h2>7. Encerramento de Conta</h2>
                <p>
                  Podemos suspender ou encerrar seu acesso imediatamente, sem aviso prévio, caso você viole estes Termos, especialmente no que tange a upload de conteúdo proibido ou abuso da infraestrutura.
                </p>
              </section>

              <section id="abuse" className="mb-12">
                <h2>8. Denúncias</h2>
                <p>
                  Se você encontrar algum link hospedado no ColetivoSend que viole estes termos ou direitos autorais, por favor, denuncie imediatamente para:
                </p>
                <div className="not-prose mt-4">
                  <a href="mailto:abuso@grupocoletivo.com.br" className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent/50 rounded-lg text-foreground transition-colors font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    abuso@grupocoletivo.com.br
                  </a>
                </div>
              </section>

              <section id="forum" className="mb-12">
                <h2>9. Foro</h2>
                <p>
                  Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca da sede do Grupo Coletivo para dirimir quaisquer dúvidas oriundas deste instrumento.
                </p>
              </section>

            </article>
          </div>
        </div>
      </main>

      {/* Back to top FAB */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 w-12 h-12 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-700 transition-colors z-40"
        aria-label="Voltar ao topo"
      >
        <ArrowUp className="w-6 h-6" />
      </motion.button>

      {/* Simple Footer */}
      <footer className="bg-background border-t border-border py-12 px-6">
        <div className="max-w-4xl mx-auto text-center text-surface-500 text-sm">
          <p>&copy; {new Date().getFullYear()} ColetivoSend. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
