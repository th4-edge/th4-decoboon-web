import { post, upload as uploadRequest } from '@/core/http'
import { runtime } from '@/core/runtime'
import type { PrivateFileScope, UploadedFile } from './model'

interface RawFileGrant {
  path?: string
  url?: string
  expiresAt?: string
  name?: string
  contentType?: string
  size?: number
}

function isManagedPath(path: string): boolean {
  const value = path.replace(/^\/+/, '')
  return value.startsWith('upload/') || value.startsWith('companies/') || value.startsWith('system/')
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/file/private/download')) {
    return runtime.apiBase.replace(/\/$/, '') + path
  }
  return path
}

function storageKey(path: string): string {
  return path.replace(/^\/+/, '').replace(/^upload\//, '')
}

function normalizeGrant(raw: RawFileGrant): UploadedFile {
  const path = String(raw.path ?? '')
  return {
    path,
    url: raw.url ? absoluteUrl(String(raw.url)) : absoluteUrl(`/file/private/download?path=${encodeURIComponent(path)}`),
    name: raw.name,
    contentType: raw.contentType,
    size: raw.size
  }
}

export async function uploadFile(
  businessType: PrivateFileScope,
  file: File,
  options: { projectId?: string } = {}
): Promise<UploadedFile> {
  const grants = await uploadRequest<RawFileGrant[]>('file/private/grant', file, {
    businessType,
    projectId: options.projectId
  })
  const grant = grants?.[0]
  if (!grant?.path) throw new Error('文件上传失败，请重新选择文件后重试')
  return normalizeGrant(grant)
}

export async function grantFiles(
  businessType: PrivateFileScope,
  businessId: string,
  paths: string[]
): Promise<string[]> {
  const managedPaths = [...new Set(paths.filter((path) => typeof path === 'string' && isManagedPath(path)))]
  if (!managedPaths.length) return paths
  const grants = await post<RawFileGrant[]>('file/private/grant', {
    businessType,
    businessId,
    paths: managedPaths
  })
  const byPath = new Map(grants.map((grant) => [grant.path ?? '', grant.url ? absoluteUrl(grant.url) : '']))
  return paths.map((path) => {
    if (!isManagedPath(path)) return path
    return byPath.get(storageKey(path)) || path
  })
}

export function storagePath(value?: string): string | undefined {
  if (!value) return undefined
  if (value.includes('/file/private/download')) {
    const query = value.split('?')[1]
    if (!query) return value
    const pair = query.split('&').find((item) => item.startsWith('path='))
    return pair ? decodeURIComponent(pair.slice('path='.length)) : value
  }
  if (/^https?:\/\//i.test(value)) {
    const path = value.replace(/^https?:\/\/[^/]+/i, '').split('?')[0]
    const index = path.indexOf('/companies/') >= 0 ? path.indexOf('/companies/') : path.indexOf('/system/')
    if (index < 0) return value
    return decodeURIComponent(path.slice(index + 1))
  }
  return storageKey(value)
}

export const fileApi = { absolute: (path?: string) => (path ? absoluteUrl(path) : ''), uploadFile, grantFiles, storagePath, isManagedPath }
