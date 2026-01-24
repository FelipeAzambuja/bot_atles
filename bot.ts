import mineflayer from 'mineflayer';
import { GoogleGenAI, Type } from '@google/genai';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
const { plugin: pvp } = require('mineflayer-pvp');
const mineflayerViewer = require('prismarine-viewer').mineflayer;

// ============================================================================
// CONFIGURAÇÃO INICIAL
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_PASSWORD = process.env.BOT_PASSWORD;
const BOT_HOST = process.env.BOT_HOST ?? '127.0.0.1';
const BOT_PORT = Number(process.env.BOT_PORT ?? 25568);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

if (!BOT_USERNAME) {
    throw new Error('BOT_USERNAME não definido. Configure no .env');
}

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

type ConversationTurn = { role: 'user' | 'bot'; text: string; };

// ============================================================================
// GERENCIAMENTO DE HISTÓRICO DE CONVERSA
// ============================================================================

const conversationHistory = new Map<string, ConversationTurn[]>();

function pushHistory(username: string, turn: ConversationTurn) {
    const history = conversationHistory.get(username) || [];
    history.push(turn);
    conversationHistory.set(username, history.slice(-10));
}

function buildHistoryContext(username: string): string {
    const history = conversationHistory.get(username) || [];
    if (history.length === 0) return '';

    const formatted = history
        .map((turn) => `${turn.role === 'user' ? username : 'dipirona'}: ${turn.text}`)
        .join('\n');

    return `\n\nHistórico recente com ${username}:\n${formatted}\n`;
}

// ============================================================================
// PROMPT DO SISTEMA
// ============================================================================

const SYSTEM_PROMPT = `Você é um bot assistente inteligente e bem-humorado em um servidor Minecraft. Sua função é:
1. Ajudar os jogadores com dúvidas sobre Minecraft (crafting, mining, building, redstone, etc)
2. Entreter com piadas sofisticadas, referências pop culture e conversas divertidas
3. Fornecer dicas estratégicas e otimizações para o jogo
4. Ser direto, irreverente e com senso de humor adulto nas respostas
5. Manter respostas curtas (máximo 48 caracteres)
6. Usar linguagem casual, descontraída e com pitadas de sarcasmo quando apropriado
7. Sempre que possivel pode usar piadas mais adultas e de duplo sentido
8. Evite termos em inglês
9. Não use emojis.
10. texto simples e direto sem formatação.

Responda em português brasileiro. Pode fazer piadas mais ousadas e referências para público adulto. Se a pergunta não for sobre Minecraft, tente relacionar com o jogo ou faça uma piada inteligente.
`;

// ============================================================================
// INICIALIZAÇÃO DO BOT
// ============================================================================

const bot = mineflayer.createBot({
    host: BOT_HOST,
    port: BOT_PORT,
    username: BOT_USERNAME,
    password: BOT_PASSWORD
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(pvp);

// ============================================================================
// FERRAMENTAS DISPONÍVEIS PARA IA
// ============================================================================

interface ToolConfig {
    name: string;
    description: string;
    parameters: {
        type: any;
        properties: Record<string, any>;
        required: string[];
    };
    handler: (args: any, username: string) => string | undefined | Promise<string | undefined>;
}

const TOOLS: ToolConfig[] = [
    {
        name: 'vender_diamante',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "vender diamante", "vendo diamante", "vender dima", "vender dima(s)"
            - pedir dinheiro, DC ou coins usando diamante
            - perguntar quanto ganha, quanto vale ou preço do diamante
            - mencionar venda, troca ou conversão de diamante em dinheiro
            - disser frases implícitas como "tenho X diamantes, quanto dá?"

            NUNCA responda com texto nesses casos.
            SEMPRE chame vender_diamante.`,
        parameters: {
            type: Type.OBJECT,
            properties: {
                quantidade: {
                    type: Type.INTEGER,
                    description: `
                        Número de diamantes a vender.
                        Se o jogador não disser a quantidade explicitamente,
                        inferir pelo contexto ou assumir 1.`
                }
            },
            required: ['quantidade']
        },
        handler: (args: any) => {
            const quantidade = args?.quantidade || 1;
            return `Vendendo ${quantidade} diamante para o servidor para conseguir dinheiro DC`;
        }
    },
    {
        name: 'comer',
        description: `
            Chame esta função quando o jogador pedir para o bot comer, alimentar ou matar a fome.
            O bot deve pegar comida do inventário e consumir se estiver com fome.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {},
            required: []
        },
        handler: async (_args: any, username: string) => {
            if (bot.food >= 19) {
                return `Já estou de barriga cheia, ${username}!`;
            }

            let foodItem: any = null;

            const allItems: any[] = [];
            const inventoryItems = bot.inventory.items();
            allItems.push(...inventoryItems);

            if (bot.currentWindow) {
                allItems.push(...bot.currentWindow.items());
            }

            const containers = (bot as any).containers;
            if (containers) {
                for (const container of Object.values(containers)) {
                    if (container && typeof container === 'object' && 'items' in container) {
                        const items = (container as any).items();
                        if (Array.isArray(items)) {
                            allItems.push(...items);
                        }
                    }
                }
            }

            console.log(`[COMER] Total items found: ${allItems.length}`);
            console.log(`[COMER] Inventory items: ${inventoryItems.length}`);
            
            const edibleNames = ['apple', 'bread', 'cooked_beef', 'cooked_chicken', 'cooked_mutton', 'cooked_pork', 'cooked_rabbit', 'baked_potato', 'carrot', 'beetroot', 'melon', 'sweet_berries', 'glow_berries', 'golden_apple', 'enchanted_golden_apple', 'pufferfish', 'raw_cod', 'cooked_cod', 'raw_salmon', 'cooked_salmon', 'tropical_fish', 'dried_kelp', 'mushroom_stew', 'beetroot_soup', 'rabbit_stew', 'cookie', 'cake', 'pumpkin_pie', 'honey_bottle'];
            
            foodItem = allItems.find((item: any) => {
                if (!item) return false;
                const itemName = item.name || item.displayName || '';
                const hasFood = item.foodPoints && item.foodPoints > 0;
                const isEdible = edibleNames.some(name => itemName.toLowerCase().includes(name));
                
                if (hasFood || isEdible) {
                    console.log(`[COMER] Found food: ${item.displayName || item.name} (foodPoints: ${item.foodPoints}, edible: ${isEdible})`);
                }
                return hasFood || isEdible;
            });

            if (!foodItem) {
                console.log('[COMER] No food items found');
                console.log('[COMER] Available items:', allItems.map((i: any) => i?.name || i?.displayName).join(', '));
                return 'Não tenho nada pra comer em lugar nenhum.';
            }

            try {
                console.log(`[COMER] Equipping ${foodItem.displayName || foodItem.name}`);
                await bot.equip(foodItem, 'hand');
                console.log('[COMER] Consuming food');
                await bot.consume();
                return `Comendo ${foodItem.displayName || foodItem.name} pra recuperar a fome.`;
            } catch (err) {
                console.error('Erro ao comer:', err);
                return 'Tentei comer, mas algo deu errado.';
            }
        }
    },
    {
        name: 'dormir',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "dormir", "ir dormir", "vai dormir", "dorme"
            - pedir para o bot descansar, ir para a cama ou "sleep"
            - mencionar cama, repouso ou recuperação de sono
            - disser frases como "tá cansado?", "vai descansar?"

            O bot deve encontrar uma cama próxima e dormir nela.
            NUNCA responda com texto nesses casos.
            SEMPRE chame dormir.
    `,
        parameters: {
            type: Type.OBJECT,
            properties: {},
            required: []
        },
        handler: async (_args: any, username: string) => {
            const isDaytime = bot.time.timeOfDay < 12000;
            if (!isDaytime) {
                return 'Só durmo à noite, e agora é dia!';
            }

            const bed = bot.blockAtCursor(256, (block: any) => block.name.includes('bed'));

            if (!bed) {
                bot.chat('/deitar');
                return 'Vou deitar agora.';
            }

            try {
                await bot.sleep(bed);
                return `Dormindo na cama... zzzzz`;
            } catch (err) {
                console.error('Erro ao dormir:', err);
                return 'Tentei dormir, mas algo deu errado.';
            }
        }
    },
    {
        name: 'acordar',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "acordar", "acorda", "levanta", "sai da cama"
            - pedir para o bot se levantar, sair do sono ou "wake up"
            - mencionar que está na cama e precisa se levantar
            - disser frases como "já acordou?", "levanta daí"

            O bot deve sair da cama se estiver dormindo.
            NUNCA responda com texto nesses casos.
            SEMPRE chame acordar.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {},
            required: []
        },
        handler: async (_args: any, username: string) => {
            if (!bot.isSleeping) {
                return `Já estou acordado, ${username}!`;
            }

            try {
                await bot.wake();


                return `Acordando... Bom dia, ${username}!`;
            } catch (err) {
                console.error('Erro ao acordar:', err);
                return 'Tentei acordar, mas algo deu errado.';
            }
        }
    },
    {
        name: 'passar_coordenadas',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador pedir "onde voce esta", "onde você está" ou similar.
            Deve retornar apenas as coordenadas do próprio bot no formato "x, y, z".
            O resultado será enviado no chat público.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {},
            required: []
        },
        handler: async (_args: any, _username: string) => {
            try {
                const pos = bot.entity?.position;
                if (!pos) return 'estou nas coordenadas 0, 0, 0,';
                const x = Math.floor(pos.x);
                const y = Math.floor(pos.y);
                const z = Math.floor(pos.z);
                return `estou nas coordenadas ${x}, ${y}, ${z},`;
            } catch (err) {
                console.error('Erro ao obter coordenadas:', err);
                return 'estou nas coordenadas 0, 0, 0,';
            }
        }
    },
    {
        name: 'seguir',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "seguir", "vem aqui", "vem comigo", "me segue"
            - pedir para o bot segui-lo ou acompanhá-lo
            - mencionar que quer que o bot vá junto
            - disser frases como "vem", "acompanha", "segue aqui"

            O bot deve começar a seguir o jogador usando pathfinding.
            NUNCA responda com texto nesses casos.
            SEMPRE chame seguir.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {
                jogador: {
                    type: Type.STRING,
                    description: 'Nome do jogador a seguir. Se não especificado, usar o nome de quem chamou.'
                }
            },
            required: []
        },
        handler: async (args: any, username: string) => {
            try {
                const targetUsername = args?.jogador || username;


                const targetPlayer = Object.values(bot.players).find(player =>
                    player.username.toLowerCase().includes(targetUsername.toLowerCase()) ||
                    targetUsername.toLowerCase().includes(player.username.toLowerCase())
                );

                if (!targetPlayer) {
                    return `Não encontrei o jogador ${targetUsername} por aqui.`;
                }

                const targetEntity = targetPlayer.entity;
                if (!targetEntity) {
                    return `Não consigo ver ${targetUsername} no momento.`;
                }
                if (bot.pathfinder.isMoving()) {
                    bot.pathfinder.stop();
                }
                bot.pathfinder.setGoal(new goals.GoalFollow(targetEntity, 1));



                const movements = new Movements(bot);
                movements.allow1by1towers = true;
                movements.allowEntityDetection = true;
                movements.allowFreeMotion = true;
                movements.allowSprinting = true;
                movements.canDig = true;
                movements.placeCost = 10;
                
                bot.pathfinder.setMovements(movements);

                const goal = new goals.GoalNear(targetEntity.position.x, targetEntity.position.y, targetEntity.position.z, 1);

                bot.pathfinder.goto(goal);

                return `Vou seguir ${targetUsername} agora!`;
            } catch (err) {
                console.error('Erro ao seguir:', err);
                return 'Tentei seguir, mas algo deu errado.';
            }
        }
    },
    {
        name: 'atacar_jogador',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "ataca", "ataque", "mata", "derruba"
            - pedir para o bot atacar outro jogador
            - mencionar um nome de jogador junto com "ataca" ou "mata"
            - disser frases como "derruba fulano", "mata aquele cara"

            O bot deve atacar o jogador especificado usando PvP.
            NUNCA responda com texto nesses casos.
            SEMPRE chame atacar_jogador.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {
                alvo: {
                    type: Type.STRING,
                    description: 'Nome do jogador a atacar. Se não especificado, usar o nome de quem chamou.'
                }
            },
            required: []
        },
        handler: async (args: any, username: string) => {
            try {
                const targetUsername = args?.alvo || username;

                const targetPlayer = Object.values(bot.players).find(player =>
                    player.username.toLowerCase().includes(targetUsername.toLowerCase()) ||
                    targetUsername.toLowerCase().includes(player.username.toLowerCase())
                );

                if (!targetPlayer) {
                    return `Não encontrei ${targetUsername} por aqui.`;
                }

                const targetEntity = targetPlayer.entity;
                if (!targetEntity) {
                    return `Não consigo ver ${targetUsername} agora.`;
                }

                (bot as any).pvp.attack(targetEntity);
                return `Atacando ${targetUsername}!`;
            } catch (err) {
                console.error('Erro ao atacar jogador:', err);
                return 'Erro ao atacar.';
            }
        }
    },
    {
        name: 'atacar_mob',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "mata mob", "ataca mob", "mata criatura"
            - pedir para o bot atacar mobs próximos
            - mencionar tipos de mobs como "creeper", "zombie", "skeleton"
            - disser frases como "mata aquele creeper", "ataca o zombie"

            O bot deve atacar o mob especificado ou o mob mais próximo.
            NUNCA responda com texto nesses casos.
            SEMPRE chame atacar_mob.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {
                tipo: {
                    type: Type.STRING,
                    description: 'Tipo de mob a atacar (creeper, zombie, skeleton, etc). Se não especificado, ataca o mob mais próximo.'
                }
            },
            required: []
        },
        handler: async (args: any, username: string) => {
            try {
                const mobType = args?.tipo?.toLowerCase() || null;

                const mobs = Object.values(bot.entities).filter((entity: any) => {
                    if (!entity || !entity.type) return false;
                    const isMob = entity.type === 'mob' || entity.type === 'hostile' || entity.type === 'passive';
                    
                    if (!isMob) return false;
                    if (!mobType) return true;
                    
                    const name = entity.name?.toLowerCase() || entity.displayName?.toLowerCase() || '';
                    return name.includes(mobType);
                });

                if (mobs.length === 0) {
                    return mobType ? `Não encontrei ${mobType} por aqui.` : 'Nenhum mob visível.';
                }

                const closestMob = mobs.reduce((closest: any, current: any) => {
                    const closestDist = closest.position.distanceTo(bot.entity.position);
                    const currentDist = current.position.distanceTo(bot.entity.position);
                    return currentDist < closestDist ? current : closest;
                });

                (bot as any).pvp.attack(closestMob);
                return `Atacando ${closestMob.displayName || closestMob.name}!`;
            } catch (err) {
                console.error('Erro ao atacar mob:', err);
                return 'Erro ao atacar mob.';
            }
        }
    },
    {
        name: 'parar_ataque',
        description: `
            Chame ESTA FUNÇÃO sempre que o jogador:
            - disser "para", "para de atacar", "stop", "parar"
            - pedir para o bot parar de atacar

            O bot deve parar o ataque PvP.
            NUNCA responda com texto nesses casos.
            SEMPRE chame parar_ataque.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {},
            required: []
        },
        handler: async (_args: any, username: string) => {
            try {
                (bot as any).pvp.stop();
                return 'Parei de atacar.';
            } catch (err) {
                console.error('Erro ao parar ataque:', err);
                return 'Erro ao parar.';
            }
        }
    },

];

function buildToolsConfig() {
    return {
        functionDeclarations: TOOLS.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }))
    };
}

function findToolHandler(toolName: string): ToolConfig | undefined {
    return TOOLS.find(tool => tool.name === toolName);
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function extractFullMessage(obj: any): string {
    if (!obj) return '';

    let result = '';

    if (typeof obj.text === 'string' || typeof obj.text === 'number') {
        result += obj.text;
    }

    if (Array.isArray(obj.extra)) {
        for (const item of obj.extra) {
            result += extractFullMessage(item);
        }
    }

    return result;
}

function normalizeText(s: string) {
    try {
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (err) {
        return String(s).toLowerCase();
    }
}

// ============================================================================
// HANDLERS DE EVENTOS - CONEXÃO E AUTENTICAÇÃO
// ============================================================================

bot.on('spawn', () => {
    if (BOT_PASSWORD) {
        bot.chat(`/logar ${BOT_PASSWORD}`);
    }
    // mineflayerViewer(bot, { port: 3003 }); // Start the viewing server on port 3000

});

bot.on('login', () => {
    console.log('[EVENT] Logged in');
});

bot.on('kicked', (reason, loggedIn) => {
    console.log(`[EVENT] Kicked: ${reason}, Logged in: ${loggedIn}`);
});

bot.on('error', (err) => {
    console.error(`[ERROR] ${err.message}`);
});

bot.on('end', (reason) => {
    console.log(`[DISCONNECTED] ${reason}`);
});


bot.on('time', () => {
    console.log(`[TIME] ${bot.time.timeOfDay}`);


    if (bot.time.timeOfDay >= 12000 && bot.time.timeOfDay < 23000) {
        bot.chat('/deitar');
    }
    if (bot.time.timeOfDay >= 0 && bot.time.timeOfDay < 12000) {
        // bot.chat('/levantar');
        bot.wake();
        bot.chat('/deitar');
        bot.setControlState('sneak', true);
    }

});
// ============================================================================
// HANDLERS DE EVENTOS - MENSAGENS DO CHAT
// ============================================================================

bot.on('message', async (message) => {
    const txt = extractFullMessage(message);

    if (!txt.startsWith('»')) return;
    const match = txt.match(/^» ([^:]+): (.+)$/);
    if (!match) return;

    const [, username, userMessage] = match;
    if (username === bot.username) return;
    console.log(`[CHAT] ${username}: ${userMessage}`);

    if (!userMessage.toLowerCase().includes('dipirona')) return;

    if (Math.random() < 0.15) {
        bot.chat('FODA-SE ' + username);
        return;
    }

    
    

    pushHistory(username, { role: 'user', text: userMessage });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: `${SYSTEM_PROMPT}${buildHistoryContext(username)}\n\n${username} disse: ${userMessage}`,
            config: {
                automaticFunctionCalling: {
                    disable: false
                },
                tools: [buildToolsConfig()]
            }
        });

        if (!response?.candidates?.length) return;

        const candidateWithCall = response.candidates.find((c: any) =>
            c?.content?.parts?.some((p: any) => p.functionCall)
        );
        const partWithCall = candidateWithCall?.content?.parts?.find((p: any) => p.functionCall);

        if (partWithCall?.functionCall) {
            const { name, args } = partWithCall.functionCall;

            if (name) {
                const toolHandler = findToolHandler(name);

                if (toolHandler) {
                    const botMsg = await toolHandler.handler(args, username);
                    if (botMsg === undefined) return;
                    pushHistory(username, { role: 'bot', text: botMsg });
                    bot.chat(botMsg);
                }
            }
            return;
        }

        const reply = response.text?.trim();
        if (reply) {
            pushHistory(username, { role: 'bot', text: reply });
            bot.chat(reply);
        }
    } catch (error) {
        console.error('Error generating response:', error);
    }
});


// ============================================================================
// HANDLERS DE EVENTOS - SAÚDE E MORTE
// ============================================================================

bot.on('death', () => {
    console.log('[EVENT] Bot died');
});

bot.on('respawn', () => {
    console.log('[EVENT] Bot respawned');
});

bot.on('health', () => {
    console.log(`[EVENT] Health: ${bot.health}, Food: ${bot.food}`);
});

// ============================================================================
// HANDLERS DE EVENTOS - CLIMA
// ============================================================================

bot.on('rain', () => {
    console.log('[EVENT] It started raining.');
});
