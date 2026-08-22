# Nexa Video Call

Aplicativo de videoconferência simples em navegador usando React, Vite, Express, Socket.IO e WebRTC.

## O que é

Esse projeto permite:

- criar uma sala
- gerar um link de convite
- entrar em chamada com áudio e vídeo
- trocar mensagens em chat
- compartilhar tela

## Estrutura

```text
videocall/
├── client/        # frontend (React + Vite)
├── server/        # backend (Express + Socket.IO)
├── start_app.bat  # abre backend e frontend juntos
├── start_public.bat  # abre backend, frontend e ngrok juntos
├── scripts/
│   └── start_public.ps1
├── ngrok.yml      # configuração dos túneis do ngrok
├── README.md      # documentação
```

## Requisitos

- Node.js 18+
- npm 9+
- Windows 10/11

## Como rodar

### Método 1: em uma tacada só

1. Abra a pasta do projeto.
2. Dê duplo clique em `start_app.bat`.
3. O script vai abrir duas janelas:
   - uma para o backend
   - outra para o frontend
4. Abra no navegador:

```text
http://localhost:5173
```

---

### Método 2: rodar manualmente

#### Backend

```cmd
cd /d "C:\Users\user\Downloads\nexa-videocall\videocall\server"
npm install
npm run dev
```

#### Frontend

Em outro terminal:

```cmd
cd /d "C:\Users\user\Downloads\nexa-videocall\videocall\client"
npm install
npm run dev -- --host 0.0.0.0
```

Acesse:

```text
http://localhost:5173
```

---

## Se aparecer erro de porta ocupada

O backend usa a porta `4000`.

Para verificar:

```cmd
netstat -ano | findstr :4000
```

Para encerrar o processo:

```cmd
taskkill /PID <PID> /F
```

Exemplo:

```cmd
taskkill /PID 13888 /F
```

Depois rode novamente o backend.

---

## Arquivo de inicialização

O conteúdo do arquivo `start_app.bat` é:

```bat
@echo off
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :4000') do (
    if not "%%P"=="" taskkill /PID %%P /F >nul 2>&1
)

start "Servidor" cmd /k "cd /d ""C:\Users\user\Downloads\nexa-videocall\videocall\server"" && npm run dev"
start "Frontend" cmd /k "cd /d ""C:\Users\user\Downloads\nexa-videocall\videocall\client"" && npm run dev -- --host 0.0.0.0"
```

---

## Método 3: público com ngrok automático

Para abrir o app em qualquer aparelho de outra cidade, rode o launcher público:

```cmd
cd /d "C:\Users\user\Downloads\nexa-videocall\videocall"
start_public.bat
```

Esse script faz automaticamente:

- inicia o backend em `server`
- inicia o frontend em `client`
- abre o ngrok para expor `5173` e `4000`
- imprime as URLs públicas geradas pelo ngrok

Antes, você precisa ter o ngrok instalado e autenticado:

```cmd
ngrok config add-authtoken SEU_TOKEN_AQUI
```

ou configurar a variável de ambiente:

```cmd
set NGROK_AUTHTOKEN=SEU_TOKEN_AQUI
```

Depois basta rodar `start_public.bat`.

---

## Acesso em outros aparelhos (rede local e internet)

O projeto já aceita dois cenários:

1. Rede local: funciona com IP local do computador e sem IP fixo no código
2. Internet pública: funciona quando a aplicação estiver exposta em um domínio público ou em um túnel

### Rede local

- o backend escuta em `0.0.0.0:4000`
- o frontend usa automaticamente o mesmo host da página atual para chamar o backend
- a CORS foi liberada para origens locais e da rede interna em desenvolvimento

Como testar:

```text
http://192.168.1.10:5173
```

### Internet pública

Para funcionar em qualquer aparelho fora da sua rede, o app precisa estar acessível em um host público. Isso não acontece apenas abrindo o computador local.

#### Opção 1: usar túnel (mais simples para teste)

```bash
# backend local
cd server
npm run dev

# frontend local
cd client
npm run dev -- --host 0.0.0.0
```

Em seguida, exponha o frontend e o backend por um túnel (por exemplo `ngrok` ou `Cloudflare Tunnel`) e configure:

```env
# client/.env
VITE_SERVER_URL=https://seu-backend-publico.ngrok-free.app
```

```env
# server/.env
CLIENT_URL=https://seu-frontend-publico.ngrok-free.app
```

#### Opção 2: publicar em um servidor real

- hospede o frontend em um serviço estático ou em um VPS
- hospede o backend em um VPS/Container/App Service
- configure `CLIENT_URL` no backend e `VITE_SERVER_URL` no frontend para os domínios públicos

> Importante: para WebRTC funcionar pela internet, o backend precisa estar em um host público e, em muitos cenários, pode ser necessário TURN/STUN em produção.

## Observações

- Backend local: `http://localhost:4000`
- Frontend local: `http://localhost:5173`
- Em outra máquina da mesma rede, use o IP da máquina hospedeira, como `http://192.168.1.10:5173`
- Para acesso global, configure URLs públicas no `.env` e exponha o app via túnel ou hospedagem real
//
cd "c:\Users\user\Downloads\nexa-videocall\videocall\client"
npm run build





cd /d "C:\Users\user\Downloads\nexa-videocall\videocall"
start_public.batngrok version
ngrok start --all --config "C:\Users\user\Downloads\nexa-videocall\videocall\ngrok.yml"