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
- **Orbe central** em forma de mostrador: o arco dourado marca os segundos, o ponto dourado marca a hora e o vermelho marca os minutos. Os anéis aceleram enquanto o Horácio "pensa".
- **Conversa por texto** com respostas locais sobre o tempo: horas, data, quanto falta para a meia-noite ou para o Ano Novo, e quanto do ano já passou.
- **Memória:** a conversa e a última visita ficam salvas no aparelho. O Horácio lembra há quanto tempo vocês não conversam.
- **Controle de voz:** toque no microfone ou no orbe e fale. O Horácio ouve em português, responde falando e, se você quiser, volta a ouvir sozinho.
- **Personalização baseada em tempo:**
  - **Era:** temas ligados à hora do dia. Aurora, Tarde, Crepúsculo e Meia-noite, ou a opção Automática, que segue o relógio.
  - **Relógio:** formato 24h ou 12h, com ou sem segundos.
  - **Ritmo:** Calmo, Sereno ou Vivo, para a cadência das animações, das respostas e da fala.
  - **Voz:** responder falando Sempre, Se eu falar ou Nunca; escolha da voz; conversa contínua.

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
- O Horácio prefere uma voz masculina em português do Brasil quando o aparelho tem uma (por exemplo, "Felipe" no iPhone).

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
js/voice.js           ouvir e falar (Web Speech API)
js/app.js             interface: orbe, relógio, conversa e personalização
manifest.webmanifest  permite instalar o site na tela inicial
```

## Próximas etapas

- [x] Controle de voz (ouvir e falar)
- [ ] Palavra de ativação ("Horácio…") sem precisar tocar
- [ ] Integração com um modelo de IA no `brain.js`
- [ ] Lembretes e alarmes
- [ ] Funcionamento offline (service worker)
