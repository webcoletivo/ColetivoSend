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
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

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
        const imageUrl = data.image ? `${data.image}?v=${Date.now()}` : null
        await update({ name, image: imageUrl })
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
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {initials}
                </div>
              )}
              <button
                onClick={handleAvatarClick}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary-600 transition-colors"
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
    </div>
  )
}
