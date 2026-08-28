import { redirect } from 'next/navigation'

/**
 * Unificação por abas: dados da pessoa ficam em "Sua conta", na plataforma.
 */
export default function ProfileSettingsPage() {
  redirect('/conta')
}
