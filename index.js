const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const fetch = require('node-fetch');
const mineflayer = require('mineflayer');
const config = require('./config.json');

// ============================================
// PHẦN 1: DISCORD BOT
// ============================================
const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ===== HÀM KIỂM TRA SERVER (DÙNG API) =====
async function checkServer() {
    try {
        console.log(`🔍 Đang kiểm tra server ${config.minecraftHost}...`);
        
        // Gọi API của Aternos (nếu có)
        // Hoặc dùng cách ping thủ công
        
        // Cách 1: Dùng fetch để kiểm tra web
        const response = await fetch(`https://api.mcsrvstat.us/2/${config.minecraftHost}:${config.minecraftPort}`);
        const data = await response.json();
        
        if (data.online) {
            console.log(`✅ Server online! Players: ${data.players.online}`);
            return {
                online: true,
                players: data.players.online || 0,
                max: data.players.max || 20,
                version: data.version || '1.21.11',
                latency: data.ping || 0,
                motd: data.motd?.clean?.[0] || 'Minecraft Server'
            };
        } else {
            console.log('❌ Server offline!');
            return { online: false };
        }
    } catch (error) {
        console.log(`⚠️ Lỗi API: ${error.message}`);
        
        // Fallback: thử ping thủ công
        try {
            const net = require('net');
            const socket = net.createConnection(config.minecraftPort, config.minecraftHost);
            
            return new Promise((resolve) => {
                socket.on('connect', () => {
                    console.log('✅ Server online (socket)!');
                    socket.destroy();
                    resolve({
                        online: true,
                        players: '?',
                        max: '?',
                        version: 'Unknown',
                        latency: 0,
                        motd: 'Minecraft Server'
                    });
                });
                socket.on('error', () => {
                    console.log('❌ Server offline (socket)!');
                    resolve({ online: false });
                });
                socket.setTimeout(3000, () => {
                    console.log('⏰ Timeout!');
                    socket.destroy();
                    resolve({ online: false });
                });
            });
        } catch (err) {
            console.log(`❌ Lỗi fallback: ${err.message}`);
            return { online: false };
        }
    }
}

// ===== TẠO EMBED =====
function createStatusEmbed(data) {
    const embed = new EmbedBuilder()
        .setTitle('🎮 Minecraft Server Status')
        .setDescription(`\`${config.minecraftHost}:${config.minecraftPort}\``)
        .setColor(data.online ? 0x00FF00 : 0xFF0000)
        .setTimestamp()
        .setFooter({ text: 'Bot AFK 24/7' });

    if (data.online) {
        embed.addFields(
            { name: '🟢 Trạng thái', value: '```✅ Online```', inline: true },
            { name: '👥 Người chơi', value: `\`${data.players}/${data.max}\``, inline: true },
            { name: '📌 Version', value: `\`${data.version}\``, inline: true },
            { name: '📶 Ping', value: `\`${data.latency}ms\``, inline: true },
            { name: '📝 MOTD', value: `\`${data.motd || 'No MOTD'}\``, inline: false }
        );
    } else {
        embed.setDescription('❌ **Server đang tắt!**\n💡 Hãy bật server trên web Aternos');
        embed.addFields(
            { name: '🔗 Link', value: `[Bấm vào đây để bật server](https://aternos.org/server/)`, inline: false }
        );
    }

    return embed;
}

// ===== ĐĂNG KÝ LỆNH SLASH =====
async function registerCommands() {
    const commands = [
        { name: 'status', description: '📊 Kiểm tra trạng thái server Minecraft' },
        { name: 'players', description: '👥 Xem danh sách người chơi đang online' },
        { name: 'afk', description: '🎮 Bật/tắt bot AFK trong Minecraft' },
        { name: 'botinfo', description: 'ℹ️ Xem thông tin bot AFK' }
    ];

    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    try {
        console.log('🔄 Đang đăng ký lệnh slash...');
        await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands });
        console.log('✅ Đã đăng ký lệnh slash thành công!');
    } catch (error) {
        console.error('❌ Lỗi đăng ký lệnh:', error);
    }
}

// ===== XỬ LÝ LỆNH =====
discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await interaction.deferReply();

    const data = await checkServer();

    // Lệnh /status
    if (interaction.commandName === 'status') {
        const embed = createStatusEmbed(data);
        await interaction.editReply({ embeds: [embed] });
    }

    // Lệnh /players
    if (interaction.commandName === 'players') {
        if (!data.online) {
            const embed = new EmbedBuilder()
                .setTitle('❌ Server Offline')
                .setColor(0xFF0000)
                .setDescription('Server đang tắt, không thể lấy danh sách người chơi!')
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }
        
        try {
            // Lấy danh sách player từ API
            const response = await fetch(`https://api.mcsrvstat.us/2/${config.minecraftHost}:${config.minecraftPort}`);
            const data2 = await response.json();
            
            const playerList = data2.players?.list?.join(', ') || 'Không có ai';
            const embed = new EmbedBuilder()
                .setTitle('👥 Danh sách người chơi')
                .setColor(0x00FF00)
                .setDescription(playerList)
                .addFields(
                    { name: '📊 Số lượng', value: `\`${data2.players?.online || 0}/${data2.players?.max || 20}\``, inline: true },
                    { name: '🎮 Server', value: `\`${config.minecraftHost}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Bot AFK 24/7' });
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('❌ Không thể lấy danh sách người chơi!');
        }
    }

    // Lệnh /afk
    if (interaction.commandName === 'afk') {
        const embed = new EmbedBuilder()
            .setTitle('🎮 Bot AFK Minecraft')
            .setColor(0x00FF00)
            .setTimestamp();

        if (mcBot && mcBot.entity) {
            embed.setDescription('✅ Bot AFK đang hoạt động trong game!');
            await interaction.editReply({ embeds: [embed] });
        } else {
            embed.setDescription('🔄 Đang khởi động bot AFK...').setColor(0xFFFF00);
            await interaction.editReply({ embeds: [embed] });
            
            startAFKBot();
            setTimeout(async () => {
                if (mcBot && mcBot.entity) {
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Bot AFK Đã Vào Game!')
                        .setColor(0x00FF00)
                        .setDescription(`🎮 Bot \`${config.botName}\` đã vào server!`)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [successEmbed] });
                } else {
                    const failEmbed = new EmbedBuilder()
                        .setTitle('❌ Không Thể Khởi Động Bot')
                        .setColor(0xFF0000)
                        .setDescription('Bot AFK không thể vào server!')
                        .setTimestamp();
                    await interaction.editReply({ embeds: [failEmbed] });
                }
            }, 5000);
        }
    }

    // Lệnh /botinfo
    if (interaction.commandName === 'botinfo') {
        const status = mcBot && mcBot.entity ? '🟢 Online' : '🔴 Offline';
        const embed = new EmbedBuilder()
            .setTitle('🤖 Thông tin Bot AFK')
            .setColor(mcBot && mcBot.entity ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: '📛 Tên bot', value: `\`${config.botName}\``, inline: true },
                { name: '📊 Trạng thái', value: status, inline: true },
                { name: '📍 Server', value: `\`${config.minecraftHost}:${config.minecraftPort}\``, inline: false },
                { name: '📌 Version', value: `\`${config.version}\``, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Bot AFK 24/7' });
        await interaction.editReply({ embeds: [embed] });
    }
});

// ============================================
// PHẦN 2: AFK MINECRAFT BOT
// ============================================
let mcBot = null;
let afkInterval = null;
let reconnectAttempts = 0;

function startAFKBot() {
    if (mcBot) return;

    console.log('🔄 Đang khởi động bot AFK Minecraft...');
    
    mcBot = mineflayer.createBot({
        host: config.minecraftHost,
        port: config.minecraftPort,
        username: config.botName,
        version: config.version,
        auth: 'offline'
    });

    mcBot.on('login', () => {
        console.log(`✅ Bot ${config.botName} đã đăng nhập!`);
        reconnectAttempts = 0;
    });

    mcBot.on('spawn', () => {
        console.log('✅ Bot AFK đã vào game!');
        
        if (afkInterval) clearInterval(afkInterval);
        afkInterval = setInterval(() => {
            if (!mcBot || !mcBot.entity) return;
            
            mcBot.setControlState('jump', true);
            setTimeout(() => {
                if (mcBot && mcBot.entity) {
                    mcBot.setControlState('jump', false);
                }
            }, 200);
            
            if (Math.random() > 0.5) {
                const dirs = ['forward', 'back', 'left', 'right'];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                mcBot.setControlState(dir, true);
                setTimeout(() => {
                    if (mcBot && mcBot.entity) {
                        mcBot.setControlState(dir, false);
                    }
                }, 1500);
            }
            
            if (Math.random() > 0.3) {
                mcBot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3, false);
            }
        }, 5000);
    });

    mcBot.on('end', (reason) => {
        console.log(`❌ Bot AFK mất kết nối: ${reason}`);
        if (afkInterval) {
            clearInterval(afkInterval);
            afkInterval = null;
        }
        reconnectAttempts++;
        const waitTime = Math.min(reconnectAttempts * 5000, 60000);
        console.log(`🔄 Thử reconnect sau ${waitTime/1000}s...`);
        setTimeout(() => {
            mcBot = null;
            startAFKBot();
        }, waitTime);
    });

    mcBot.on('error', (err) => {
        console.log(`⚠️ Lỗi AFK bot: ${err.message}`);
    });

    mcBot.on('kick', (reason) => {
        console.log(`👢 Bot AFK bị kick: ${JSON.stringify(reason)}`);
    });
}

// ============================================
// KHỞI ĐỘNG
// ============================================
console.log('🚀 Khởi động hệ thống...');

discordClient.once('ready', async () => {
    console.log(`✅ Discord Bot ${discordClient.user.tag} đã sẵn sàng!`);
    await registerCommands();
});

discordClient.login(config.discordToken);

setTimeout(() => {
    console.log('🔄 Khởi động bot AFK Minecraft...');
    startAFKBot();
}, 5000);

process.on('SIGINT', () => {
    console.log('🛑 Đang tắt hệ thống...');
    if (afkInterval) clearInterval(afkInterval);
    if (mcBot) mcBot.end();
    process.exit(0);
});
