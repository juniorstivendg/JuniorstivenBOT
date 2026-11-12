mkdir -p commands/downloads && cat > commands/downloads/ytmp3.js <<'EOF'
import yts from 'yt-search'

const cmd = {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloads',
  description: 'Descargar una canción de YouTube.',

  run: async ({ msg, sock, args, usedPrefix = '', command = '' }) => {
    const chat = msg.key.remoteJid
    const reply = (text) => sock.sendMessage(chat, { text }, { quoted: msg })

    try {
      if (!args?.[0]) {
        return reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }

      const input_text = args.join(' ').trim()
      const video_id = getVideoId(input_text)
      const query = video_id ? `https://youtu.be/${video_id}` : input_text

      let url = query
      let title = 'audio'
      let thumbnail = null

      try {
        const video_info = await getVideoInfo(query, video_id)

        if (video_info) {
          url = video_info.url || `https://youtu.be/${video_info.videoId}`
          title = video_info.title || title
          thumbnail = video_info.image || video_info.thumbnail || null

          const views = Number(video_info.views || 0).toLocaleString('es-HN')
          const channel = video_info.author?.name || video_info.author || 'Desconocido'

          const info_message = `➩ Descargando › *${title}*

> ❖ Canal › *${channel}*
> ⴵ Duración › *${video_info.timestamp || 'Desconocido'}*
> ❀ Vistas › *${views}*
> ✩ Publicado › *${video_info.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`

          if (thumbnail) {
            await sock.sendMessage(chat, {
              image: { url: thumbnail },
              caption: info_message
            }, { quoted: msg })
          } else {
            await reply(info_message)
          }
        }
      } catch {}

      if (!isYTUrl(url)) {
        return reply('《✧》No se encontró un video válido de YouTube.')
      }

      const audio = await getAudioFromApi(url)

      if (!audio?.buffer?.length) {
        return reply('《✧》No se pudo descargar el *audio*, intenta más tarde.')
      }

      await sock.sendMessage(chat, {
        audio: audio.buffer,
        fileName: audio.name || `${title}.mp3`,
        mimetype: 'audio/mpeg'
      }, { quoted: msg })
    } catch (e) {
      await reply(
        `> Ocurrió un error al ejecutar el comando *${usedPrefix + command}*.\n> [Error: *${e.message}*]`
      )
    }
  }
}

export default cmd

const isYTUrl = (url = '') =>
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

const getVideoId = (text = '') => {
  const raw = String(text || '').trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ]

  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

async function getVideoInfo(input, video_id) {
  if (video_id) {
    try {
      const info = await yts({ videoId: video_id })
      if (info?.videoId) {
        return {
          ...info,
          url: `https://youtu.be/${info.videoId}`,
          image: info.thumbnail || info.image
        }
      }
    } catch {}
  }

  const search = await yts(input)
  return search.videos?.[0] || search.all?.find(v => v.type === 'video') || null
}

async function getAudioFromApi(url) {
  const apikey = process.env.LEMPI_API_KEY || 'montekey28'
  const api_url = `https://api.lempi.lat/dl/yta?url=${encodeURIComponent(url)}&apikey=${apikey}`

  const res = await fetch(api_url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000)
  })

  if (!res.ok) throw new Error(`API falló: HTTP ${res.status}`)

  const json = await res.json()

  if (!json?.status || !json?.descarga?.url) {
    throw new Error('No se encontró el enlace de descarga en la API.')
  }

  const audio_res = await fetch(json.descarga.url, {
    signal: AbortSignal.timeout(120_000)
  })
  if (!audio_res.ok) throw new Error(`No se pudo descargar el audio: HTTP ${audio_res.status}`)

  const buffer = Buffer.from(await audio_res.arrayBuffer())

  return {
    buffer,
    name: json.descarga.archivo || 'audio.mp3'
  }
}
EOF
npm install yt-search && node -v
