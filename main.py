import os
import discord
from discord.ext import commands
import yt_dlp
import asyncio

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# Cấu hình yt-dlp để lấy audio
YTDL_OPTIONS = {
    'format': 'bestaudio/best',
    'extractaudio': True,
    'audioformat': 'mp3',
    'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
    'restrictfilenames': True,
    'noplaylist': True,
    'nocheckcertificate': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0'
}

FFMPEG_OPTIONS = {
    'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    'options': '-vn'
}

ytdl = yt_dlp.YoutubeDL(YTDL_OPTIONS)

@bot.event
async def on_ready():
    print(f'🤖 Bot Python đã sẵn sàng: {bot.user.name}')

@bot.command(name='play', aliases=['p'])
async def play(ctx, *, url):
    if not ctx.author.voice:
        return await ctx.send("❌ Bạn cần vào kênh thoại trước!")

    channel = ctx.author.voice.channel
    if ctx.voice_client is None:
        await channel.connect()

    async with ctx.typing():
        # Trích xuất dữ liệu bài hát từ URL hoặc từ khóa tìm kiếm
        data = await asyncio.get_event_loop().run_in_executor(None, lambda: ytdl.extract_info(url, download=False))
        
        if 'entries' in data:
            data = data['entries'][0]

        filename = data['url']
        title = data.get('title', 'Bài hát')

        # Phát nhạc qua FFmpeg
        player = discord.FFmpegPCMAudio(filename, **FFMPEG_OPTIONS)
        ctx.voice_client.play(player, after=lambda e: print(f'Lỗi: {e}') if e else None)

    await ctx.send(f'🎶 **Đang phát:** `{title}`')

@bot.command(name='stop', aliases=['dc'])
async def stop(ctx):
    if ctx.voice_client:
        await ctx.voice_client.disconnect()
        await ctx.send("⏹️ **Đã ngắt kết nối!**")

@bot.command(name='skip', aliases=['s'])
async def skip(ctx):
    if ctx.voice_client and ctx.voice_client.is_playing():
        ctx.voice_client.stop()
        await ctx.send("⏭️ **Đã bỏ qua bài hát!**")

bot.run(os.getenv('DISCORD_TOKEN'))
