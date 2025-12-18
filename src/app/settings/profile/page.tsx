'use client'

import React, { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { 
  Camera, 
  Trash2, 
  Save, 
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  X,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { UserAvatar } from '@/components/UserAvatar'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const user = session?.user
  const { showToast } = useToast()

  const [name, setName] = useState(user?.name || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.image || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Password state
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [hasPassword, setHasPassword] = useState(true)

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch user data
  React.useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setHasPassword(!!data.hasPassword)
          setName(data.name || user?.name || '')
          setAvatarPreview(data.image || user?.image || '')
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }
    if (user) {
      fetchUserData()
    }
  }, [user])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview('')
    setAvatarFile(null)
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)

    try {
      const formData = new FormData()
      formData.append('name', name)
      if (avatarFile) {
        formData.append('avatar', avatarFile)
      } else if (!avatarPreview) {
        formData.append('removeAvatar', 'true')
      }

      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        showToast('Perfil atualizado com sucesso!', 'success')
        // Update session with RAW key (if available) so the server can sign it on subsequent requests
        // fallback to data.image (which might be null or signed URL, but preferably raw key)
        await update({ name, image: data.imageKey || data.image })
      } else {
        showToast(data.error || 'Erro ao atualizar perfil', 'error')
      }
    } catch (error) {
      showToast('Erro ao atualizar perfil', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      showToast('As senhas não coincidem', 'error')
      return
    }

    if (newPassword.length < 8) {
      showToast('A senha deve ter pelo menos 8 caracteres', 'error')
      return
    }

    setIsChangingPassword(true)

    try {
      const res = await fetch('/api/user/password', {
        method: hasPassword ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast(hasPassword ? 'Senha alterada com sucesso!' : 'Senha criada com sucesso!', 'success')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setHasPassword(true)
        setShowPasswordSection(false)
      } else {
        showToast(data.error || 'Erro ao alterar senha', 'error')
      }
    } catch (error) {
      showToast('Erro ao alterar senha', 'error')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE' && deleteConfirmation !== 'EXCLUIR') {
      showToast('Digite a palavra de confirmação corretamente', 'error')
      return
    }

    if (hasPassword && !deletePassword) {
      showToast('Sua senha é necessária', 'error')
      return
    }

    setIsDeleting(true)

    try {
      const res = await fetch('/api/user/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        showToast('Conta excluída com sucesso', 'success')
        // Give a small delay for the toast to be seen? 
        // Or just signOut immediately as requested
        await signOut({ callbackUrl: '/' })
      } else {
        showToast(data.error || 'Erro ao excluir conta', 'error')
        setIsDeleting(false)
      }
    } catch (error) {
      showToast('Erro ao excluir conta', 'error')
      setIsDeleting(false)
    }
  }

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-900 mb-6">Informações do Perfil</h2>

        <div className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <UserAvatar 
                  user={{ name, image: avatarPreview }} 
                  size="xl" 
                  className="w-24 h-24 text-2xl border-4 border-white shadow-lg"
                />
                <button
                  onClick={handleAvatarClick}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary-600 transition-colors z-10"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            <div>
              <p className="font-medium text-surface-900">Foto de perfil</p>
              <p className="text-sm text-surface-500 mb-2">JPG, PNG ou GIF. Máx 2MB.</p>
              <div className="flex gap-2">
                <button 
                  onClick={handleAvatarClick}
                  className="text-sm text-primary-500 hover:text-primary-600 font-medium"
                >
                  Alterar
                </button>
                {avatarPreview && (
                  <button 
                    onClick={handleRemoveAvatar}
                    className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <Input
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>

          {/* Email - Read only */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-surface-500 cursor-not-allowed"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Mail className="w-5 h-5 text-surface-400" />
              </div>
            </div>
            <p className="text-xs text-surface-400 mt-1.5">
              O e-mail não pode ser alterado
            </p>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              loading={isSaving}
              icon={<Save className="w-4 h-4" />}
            >
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>

      {/* Password Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-surface-900">Senha</h2>
            <p className="text-sm text-surface-500">
              {hasPassword ? 'Altere sua senha de acesso' : 'Crie uma senha para fazer login com email'}
            </p>
          </div>
          {!showPasswordSection && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPasswordSection(true)}
              icon={<Lock className="w-4 h-4" />}
            >
              {hasPassword ? 'Alterar senha' : 'Criar senha'}
            </Button>
          )}
        </div>

        {showPasswordSection && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handlePasswordSubmit}
            className="space-y-4"
          >
            {hasPassword && (
              <div className="relative">
                <Input
                  label="Senha atual"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-9 text-surface-400 hover:text-surface-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            )}

            <div className="relative">
              <Input
                label="Nova senha"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-9 text-surface-400 hover:text-surface-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <Input
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPasswordSection(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={isChangingPassword}
              >
                {hasPassword ? 'Alterar senha' : 'Criar senha'}
              </Button>
            </div>
          </motion.form>
        )}
      </div>

      {/* Danger Zone Card */}
      <div className="card p-6 border-red-100 bg-red-50/30">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-900">Zona de Perigo</h2>
            <p className="text-sm text-red-600">Ações irreversíveis que afetam sua conta</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-red-100">
          <div>
            <p className="font-semibold text-surface-900">Excluir conta</p>
            <p className="text-sm text-surface-500 max-w-md">
              Ao excluir sua conta, todos os seus dados, envios e arquivos serão removidos permanentemente. Esta ação não pode ser desfeita.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(true)}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            Excluir minha conta
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-surface-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <button
                    onClick={() => !isDeleting && setShowDeleteModal(false)}
                    className="p-2 text-surface-400 hover:text-surface-600 rounded-lg hover:bg-surface-50 transition-colors"
                    disabled={isDeleting}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h3 className="text-xl font-bold text-surface-900 mb-2">
                  Deseja mesmo excluir sua conta?
                </h3>
                <p className="text-surface-500 mb-6">
                  Esta ação é <strong>irreversível</strong>. Você perderá acesso a todos os seus transfers e arquivos enviados.
                </p>

                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-sm text-red-700 font-medium mb-2">
                      Para confirmar, digite <strong>EXCLUIR</strong> abaixo:
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value.toUpperCase())}
                      placeholder="EXCLUIR"
                      className="w-full px-4 py-2 rounded-lg border border-red-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    />
                  </div>

                  {hasPassword && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-surface-700">
                        Sua senha atual
                      </label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-2 rounded-lg border border-surface-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-8 flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 bg-red-600 hover:bg-red-700 border-red-600 shadow-red-500/20"
                    onClick={handleDeleteAccount}
                    loading={isDeleting}
                    disabled={deleteConfirmation !== 'EXCLUIR' && deleteConfirmation !== 'DELETE'}
                  >
                    Excluir conta
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
