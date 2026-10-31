# Horácio — HoV 0.1

Assistente pessoal no estilo Jarvis, **guardião do seu tempo**.
Esta é a primeira versão (HoV 0.1): a base visual e a estrutura do site, pensada primeiro para celular.

## Como abrir

**No celular:** https://companynathanael.github.io/Hor-cio/
O site é publicado automaticamente pelo GitHub Pages a cada envio (`.github/workflows/pages.yml`).
Roteiro de teste: [TESTE-01.md](TESTE-01.md).

**No computador:** não precisa de instalação. Abra o `index.html` no navegador, ou sirva a pasta:

```bash
python3 -m http.server 8080
# acesse http://localhost:8080
```

## O que já existe

- **Saudação pelo período do dia:** Bom dia (05h–12h), Boa tarde (12h–18h) e Boa noite (18h–05h), com o nome do usuário.
- **Logo central animada:** o H com a ampulheta, na cor da era. A ampulheta vira de tempos em tempos; vira sem parar enquanto o Horácio pensa, fica vermelha quando ele ouve e pulsa quando ele fala.
- **Conversa por texto** com respostas locais sobre o tempo: horas, data, quanto falta para a meia-noite ou para o Ano Novo, e quanto do ano já passou.
- **Inteligência (Claude):** com a chave de API da Anthropic, conversa sobre qualquer assunto, pesquisa e lê páginas na web (mostrando as fontes), mostra imagens de referência (Wikimedia Commons), analisa fotos que você envia e guarda o que aprende sobre você.
- **Metas de longo prazo:** "quero juntar 10 mil reais até dezembro de 2027 para a viagem", "guardei 500 reais para a viagem", "como estão minhas metas?" — calcula o ritmo por mês/semana/dia e projeta quando você chega lá.
- **Lembretes e timers:** "me lembra em 10 minutos de tirar o bolo", "me lembra às 18h de sair", "timer de 5 minutos", "quais são meus lembretes", "cancelar lembretes".
- **Previsão do tempo:** "como está o tempo?", "vai chover amanhã?" (Open-Meteo, pela sua localização).
- **Contas:** "quanto é 15% de 230", "12 vezes 8 mais 4", "raiz de 81".
- **Dias até uma data:** "quantos dias faltam para o Natal / 15 de março".
- **Cara ou coroa e dados.**
- **Conhecimento geral sem chave:** "o que é um buraco negro?", "qual a capital da França?", "quem foi Santos Dumont?" — resumo do verbete da Wikipédia em português, com a fonte e a imagem do artigo.
- **Distância até casa e trabalho:** "Horácio, a quantos minutos estou de casa?" usa o GPS do aparelho e calcula a rota de carro, bicicleta ou a pé.
- **Chama você pelo nome** em todas as respostas. Diga "meu nome é…" ou preencha em Personalização.
- **Memória:** a conversa e a última visita ficam salvas no aparelho. O Horácio lembra há quanto tempo vocês não conversam.
- **Controle de voz:** toque no microfone ou no orbe e fale. O Horácio ouve em português, responde falando e, se você quiser, volta a ouvir sozinho.
- **Personalização baseada em tempo:**
  - **Era:** temas ligados à hora do dia. Aurora, Tarde, Crepúsculo e Meia-noite, ou a opção Automática, que segue o relógio.
  - **Relógio:** formato 24h ou 12h, com ou sem segundos.
  - **Ritmo:** Calmo, Sereno ou Vivo, para a cadência das animações, das respostas e da fala.
  - **Voz:** responder falando Sempre, Se eu falar ou Nunca; escolha da voz; tom (Profundo, Grave, Médio); conversa contínua; chamar pelo nome.

## Controle de voz

Usa a Web Speech API do próprio navegador, sem servidor.

| Navegador | Ouvir | Falar |
|-----------|-------|-------|
| Chrome (Android e computador) | ✅ | ✅ |
| Safari (iPhone e Mac) | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Firefox | ❌ | ✅ |

- O microfone exige um endereço seguro: `https://` ou `http://localhost`. Abrindo o arquivo direto (`file://`), o navegador pode bloquear.
- No Chrome, o reconhecimento de fala é processado pelos servidores do Google, então precisa de internet.
- Estados do orbe: **ouvindo** (ondas vermelhas), **pensando** (anel dourado girando) e **falando** (núcleo pulsando).
- O Horácio escolhe sozinho a melhor voz masculina do aparelho, dando preferência às vozes neurais ("Natural", "Melhorada"). O tom Profundo (padrão) deixa a voz o mais grave possível.
- Vozes mais humanas por aparelho:
  - **iPhone:** Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Português (Brasil) → baixe "Felipe (Melhorada)".
  - **Android:** Configurações → Saída de conversão de texto em voz → Mecanismo do Google → Português (Brasil) → voz masculina.
  - **Computador:** no Microsoft Edge, a voz "Antonio Online (Natural)" é a mais humana.
- Com a voz do ElevenLabs, o **Efeito na voz** dá um timbre sintético de assistente de IA: Natural, Assistente (padrão) ou Robô.

### Voz do ElevenLabs

Em Personalização → Voz → Motor de voz, escolha **ElevenLabs** e preencha:

- **Voice ID:** no ElevenLabs, Voices → My Voices → clique na voz → copie o ID.
- **Chave de API:** no seu perfil do ElevenLabs, em API Keys.
- **Modelo:** padrão `eleven_multilingual_v2`; troque se a voz foi feita para outro modelo.

A chave fica salva apenas no aparelho (nunca no código nem no GitHub). Cada resposta falada consome créditos da conta; frases repetidas reaproveitam o áudio já gerado. Se o ElevenLabs falhar (chave, créditos, conexão), o Horácio avisa uma vez e fala com a voz do aparelho.

### Inteligência

Em Personalização → Inteligência, cole a chave de API da Anthropic (console.anthropic.com → API Keys) e escolha o modelo:
Claude Opus 5.5 (padrão, o mais inteligente), Sonnet 5.5 (equilíbrio) ou Haiku 5.5 (mais rápido e barato).

- As habilidades locais respondem primeiro, de graça; só o que elas não cobrem vai para a IA.
- A chave fica salva só no aparelho e é enviada direto do navegador para a API da Anthropic.
- "Buscar na web" deixa a IA pesquisar e ler páginas (cobrado à parte pela Anthropic); as fontes aparecem abaixo da resposta.
- Ferramentas no aparelho: imagens de referência (Wikimedia Commons), metas (criar, atualizar, ver, remover) e anotações sobre o dono.
- Fotos: toque no ícone da câmera ao lado do microfone para o Horácio ver uma imagem.
- O SDK oficial (`@anthropic-ai/sdk` 0.133.0, licença MIT) vem empacotado em `js/vendor/`.

### Lugares

Em Personalização → Lugares, defina **Casa** e **Trabalho** digitando o endereço ou tocando em "Estou aqui agora". Depois pergunte:
"a quantos minutos estou de casa?", "quanto tempo até o trabalho?", "quão longe estou de casa?".

- A localização atual vem do GPS do aparelho (o navegador pede permissão na primeira vez).
- Endereços: Nominatim (OpenStreetMap). Rotas: OSRM nos servidores do OpenStreetMap — gratuitos, **sem trânsito em tempo real**.
- Se a rota falhar, o Horácio dá uma estimativa pela distância em linha reta.
- Os lugares ficam salvos só no aparelho; para calcular, as coordenadas são enviadas aos serviços do OpenStreetMap.

### Chamar pelo nome (experimental)

Com a opção ligada e o site aberto, basta dizer **"Horácio, que horas são?"**, ou só **"Horácio"** e depois o pedido.

- O navegador só libera o microfone depois de um toque, então ao abrir o site é preciso tocar uma vez na tela. O microfone fica com um ponto vermelho piscando quando está de prontidão.
- Funciona apenas com o site aberto e a tela ligada; em segundo plano o navegador desliga o microfone.
- No Android, o sistema toca um bipe toda vez que o reconhecimento de voz liga. Para não bipar sem parar, lá o Horácio mede só o volume do microfone (sem bipe) e liga o reconhecimento apenas quando alguém fala. Como chamar no Android: diga **"Horácio"**, faça uma pausa curta (o bipe toca) e então faça o pedido. Uma palavra curta seguida de pausa é tratada como chamado; fala longa e contínua (TV, conversa) só é atendida se contiver "Horácio".

## Paletas

| Era        | Fundo     | Texto     | Dourado   | Vermelho  |
|------------|-----------|-----------|-----------|-----------|
| Aurora     | `#F5EDE0` | `#3B2A20` | `#A87B2F` | `#8E2C2C` |
| Tarde      | `#E9DCC6` | `#33241A` | `#9A6E25` | `#8A2B26` |
| Crepúsculo | `#221710` | `#F1E6D4` | `#D4A64F` | `#B8483B` |
| Meia-noite | `#110C09` | `#EFE4D2` | `#C9A04A` | `#A83A2F` |

**Fontes:** Cinzel (marca), Cormorant Garamond (saudação e falas do Horácio) e Jost (interface).

## Estrutura

```
index.html            página única
css/style.css         estilos, eras e animações
js/settings.js        preferências (localStorage)
js/time.js            utilitários de tempo e períodos do dia
js/brain.js           respostas do Horácio; aqui entrará a IA
js/voice.js           ouvir e falar (Web Speech API e ElevenLabs)
js/places.js          localização, endereços e rotas (OpenStreetMap)
js/skills.js          habilidades locais: lembretes, clima, contas, datas, sorte
js/goals.js           metas de longo prazo: plano e projeção
js/knowledge.js       conhecimento geral pela Wikipédia (sem chave de IA)
js/ai.js              conversa com a IA Claude (chave do próprio dono)
js/vendor/            SDK oficial da Anthropic empacotado para o navegador
assets/logo.svg       logo do Horácio (vetor; assume a cor do tema)
js/app.js             interface: orbe, relógio, conversa e personalização
manifest.webmanifest  permite instalar o site na tela inicial
```

## Próximas etapas

- [x] Controle de voz (ouvir e falar)
- [x] Palavra de ativação ("Horácio…") com o site aberto
- [x] Voz neural profissional (ElevenLabs)
- [ ] Integração com um modelo de IA no `brain.js`
- [ ] Lembretes e alarmes
- [ ] Funcionamento offline (service worker)
