'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Shield, Lock, Eye, Server, Cookie, Mail, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function PrivacyPage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const sections = [
    { id: 'intro', label: 'Introdução' },
    { id: 'data', label: 'Dados Coletados' },
    { id: 'purpose', label: 'Finalidade' },
    { id: 'storage', label: 'Armazenamento' },
    { id: 'sharing', label: 'Compartilhamento' },
    { id: 'security', label: 'Segurança' },
    { id: 'cookies', label: 'Cookies' },
    { id: 'rights', label: 'Seus Direitos' },
    { id: 'contact', label: 'Contato' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-bold text-xl text-surface-900">
            Coletivo<span className="text-primary-500">Send</span>
          </a>
          <a href="/" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">
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
                <Shield className="w-8 h-8 text-primary-500" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-4">
                Política de Privacidade
              </h1>
              <p className="text-lg text-surface-500 max-w-2xl mx-auto">
                Transparência total sobre como tratamos seus dados e protegemos seus arquivos.
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
              
              <section id="intro" className="mb-12">
                <h2>1. Quem somos</h2>
                <p>
                  O <strong>ColetivoSend</strong> é uma plataforma de compartilhamento de arquivos desenvolvida para simplificar o envio de dados de forma segura e eficiente. 
                  Esta política descreve como coletamos, usamos e protegemos suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                </p>
              </section>

              <section id="data" className="mb-12">
                <h2>2. Quais dados coletamos</h2>
                <div className="grid sm:grid-cols-2 gap-4 not-prose mb-6">
                  <div className="p-4 bg-white rounded-xl border border-surface-200">
                    <div className="flex items-center gap-2 font-semibold text-surface-900 mb-2">
                      <Lock className="w-4 h-4 text-primary-500" />
                      Dados da Conta
                    </div>
                    <p className="text-sm text-surface-600">Nome, e-mail e senha (criptografada) para usuários cadastrados.</p>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-surface-200">
                    <div className="flex items-center gap-2 font-semibold text-surface-900 mb-2">
                      <Server className="w-4 h-4 text-primary-500" />
                      Dados do Envio
                    </div>
                    <p className="text-sm text-surface-600">Metadados dos arquivos (nome, tamanho, tipo), e-mail do destinatário e mensagem opcional.</p>
                  </div>
                </div>
                <p>
                  Também coletamos automaticamente logs de acesso (endereço IP, navegador, data e hora) para fins de segurança e auditoria, conforme exigido pelo Marco Civil da Internet.
                </p>
              </section>

              <section id="purpose" className="mb-12">
                <h2>3. Finalidade e Base Legal</h2>
                <p>O tratamento dos seus dados tem como finalidades principais:</p>
                <ul>
                  <li><strong>Execução de contrato:</strong> Para processar seus envios e entregar os arquivos aos destinatários.</li>
                  <li><strong>Legítimo interesse:</strong> Para prevenir fraudes, abusos e garantir a segurança da infraestrutura.</li>
                  <li><strong>Cumprimento legal:</strong> Para atender a requisições judiciais ou obrigações fiscais.</li>
                </ul>
              </section>

              <section id="storage" className="mb-12">
                <h2>4. Armazenamento e Retenção</h2>
                <p>
                  Os arquivos enviados são armazenados temporariamente em nossa infraestrutura segura (AWS S3).
                  <strong> Todos os arquivos possuem uma data de expiração automática</strong>, escolhida por você no momento do envio (1h, 1d, 7d ou 30d).
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-4 not-prose">
                  <h4 className="font-semibold text-amber-900 mb-1">Deleção Automática</h4>
                  <p className="text-sm text-amber-800">
                    Após a data de expiração ou quando você exclui o envio manualmente pelo painel, os arquivos são <strong>automaticamente e irreversivelmente deletados</strong> do armazenamento. Não mantemos cópias ocultas (shadow copies) dos arquivos após a expiração.
                  </p>
                </div>
              </section>

              <section id="sharing" className="mb-12">
                <h2>5. Compartilhamento de Dados</h2>
                <p>
                  Não vendemos seus dados pessoais. Compartilhamos informações apenas com parceiros essenciais para a operação do serviço:
                </p>
                <ul>
                  <li><strong>Provedores de Infraestrutura:</strong> Para hospedagem e armazenamento de arquivos (ex: Hostinger, AWS).</li>
                  <li><strong>Serviços de E-mail:</strong> Para envio de notificações transacionais (SMTP).</li>
                  <li><strong>Analytics:</strong> Dados anonimizados para melhoria de performance (opcional).</li>
                </ul>
              </section>

              <section id="security" className="mb-12">
                <h2>6. Segurança</h2>
                <p>Adotamos medidas técnicas robustas para proteger seus dados:</p>
                <ul className="list-none pl-0 space-y-2 not-prose">
                  <li className="flex items-center gap-2 text-surface-700">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Criptografia em trânsito (HTTPS/TLS)
                  </li>
                  <li className="flex items-center gap-2 text-surface-700">
                    <Lock className="w-4 h-4 text-emerald-500" />
                    Senhas hashadas com bcrypt
                  </li>
                  <li className="flex items-center gap-2 text-surface-700">
                    <Eye className="w-4 h-4 text-emerald-500" />
                    Opção de proteção por senha nos links
                  </li>
                  <li className="flex items-center gap-2 text-surface-700">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    Autenticação de dois fatores (2FA) disponível
                  </li>
                </ul>
              </section>

              <section id="cookies" className="mb-12">
                <h2>7. Cookies</h2>
                <div className="flex items-start gap-4 p-4 bg-surface-50 rounded-xl border border-surface-100 not-prose">
                  <Cookie className="w-6 h-6 text-surface-400 mt-1" />
                  <div>
                    <p className="text-sm text-surface-600">
                      Utilizamos cookies essenciais para manter sua sessão de login ativa e garantir a segurança do acesso. 
                      Não utilizamos cookies de publicidade ou rastreamento invasivo sem seu consentimento.
                    </p>
                  </div>
                </div>
              </section>

              <section id="rights" className="mb-12">
                <h2>8. Seus Direitos (LGPD)</h2>
                <p>Você tem total controle sobre seus dados. A qualquer momento, você pode solicitar:</p>
                <ul>
                  <li>Confirmação da existência de tratamento;</li>
                  <li>Acesso aos dados;</li>
                  <li>Correção de dados incompletos ou desatualizados;</li>
                  <li>Exclusão de dados pessoais (exceto quando a manutenção for necessária por lei).</li>
                </ul>
                <p>
                  A maioria dessas ações pode ser realizada diretamente no seu <strong>Painel de Controle</strong> ou nas Configurações da Conta.
                </p>
              </section>

              <section id="contact" className="mb-12">
                <h2>9. Contato</h2>
                <p>
                  Para exercer seus direitos ou tirar dúvidas sobre esta política, entre em contato com nosso Encarregado de Proteção de Dados (DPO):
                </p>
                <a href="mailto:privacidade@grupocoletivo.com.br" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium no-underline">
                  <Mail className="w-4 h-4" />
                  privacidade@grupocoletivo.com.br
                </a>
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
      <footer className="bg-white border-t border-surface-200 py-12 px-6">
        <div className="max-w-4xl mx-auto text-center text-surface-500 text-sm">
          <p>&copy; {new Date().getFullYear()} ColetivoSend. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
