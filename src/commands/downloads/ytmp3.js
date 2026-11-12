import yts from 'yt-search'

// Comando .play: descarga el audio de YouTube y lo envia como MP3 (sin portada ni descripcion).
// Usa la API publica api-faa.my.id. Si algun dia se cae, solo hay que cambiar API().
const API = (url) => `https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(url)}`
const MAX_SECONDS = 20 * 60

const cmd = {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloads',
  description: 'Descargar una canción de YouTube.',

  run: async ({ msg, sock, args }) => {
    const chat = msg.key.remoteJid
    const reply = (text) => sock.sendMessage(chat, { text }, { quoted: msg })

    try {
      if (!args?.[0]) return reply('《✧》Escribe el nombre o la URL de la canción.')

      const input = args.join(' ').trim()
      const id = getVideoId(input)
      let video_id = id
      let title = 'audio'
      let seconds = 0

      try {
        const v = id
          ? await yts({ videoId: id })
          : (await yts(input)).videos?.[0]
        if (v) {
          video_id = v.videoId || id
          title = v.title || title
          seconds = Number(v.seconds) || 0
        }
      } catch {}

      if (!video_id) return reply('《✧》No se encontró ningún video.')
      if (seconds > MAX_SECONDS) return reply('《✧》El video es muy largo (máximo 20 minutos).')

      const buffer = await download(`https://youtu.be/${video_id}`)

      await sock.sendMessage(chat, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanName(title)}.mp3`
      }, { quoted: msg })
    } catch (e) {
      console.error('[ytmp3]', e)
      await reply(`《✧》No se pudo enviar el audio.\n> ${e.message}`)
    }
  }
}

export default cmd

const cleanName = (t) =>
  String(t || 'audio').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'audio'

const getVideoId = (text = '') => {
  const s = String(text).trim()
  if (/^(?=.*[A-Z0-9_-])[\w-]{11}$/.test(s)) return s
  return s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/
  )?.[1] || null
}

async function download(url) {
  const res = await fetch(API(url), { signal: AbortSignal.timeout(60_000) })
  const text = await res.text()

  let json
  try { json = JSON.parse(text) } catch { throw new Error(`La API respondió HTTP ${res.status}`) }

  const link = findAudioUrl(json)
  if (!link) throw new Error(`La API no devolvió enlace: ${text.slice(0, 120)}`)

  const audio = await fetch(link, { signal: AbortSignal.timeout(120_000) })
  if (!audio.ok) throw new Error(`No se pudo bajar el audio: HTTP ${audio.status}`)

  const buffer = Buffer.from(await audio.arrayBuffer())
  if (buffer.length < 20_000) throw new Error('El archivo de audio llegó vacío o incompleto')
  return buffer
}

// Busca en el JSON el enlace del audio sin depender del nombre exacto del campo
function findAudioUrl(obj) {
  const found = []
  const walk = (v, key = '') => {
    if (typeof v === 'string') {
      if (/^https?:\/\//i.test(v)) found.push({ key, v })
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, k)
    }
  }
  walk(obj)

  const bad_key = /thumb|image|img|cover|poster|avatar|icon/i
  const bad_url = /\.(jpe?g|png|webp|gif)(\?|$)|youtu\.?be/i
  const score = (f) =>
    (/mp3|audio|download|dl/i.test(f.key) ? 2 : /url|link/i.test(f.key) ? 1 : 0) +
    (/\.mp3|\.m4a|audio/i.test(f.v) ? 1 : 0)

  return found
    .filter((f) => !bad_key.test(f.key) && !bad_url.test(f.v))
    .sort((a, b) => score(b) - score(a))[0]?.v
}
