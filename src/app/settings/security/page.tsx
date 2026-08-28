import { redirect } from 'next/navigation'

/**
 * Unificação por abas: senha e segurança da conta ficam na plataforma —
 * é ela quem autentica em todos os sistemas.
 */
export default function SecuritySettingsPage() {
  redirect('/conta')
}
