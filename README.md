# Kuba Tech — Sistema de Gestão

## Como rodar

### 1. Criar o banco de dados no MySQL
Abra o MySQL Workbench (ou terminal mysql) e execute o conteúdo do arquivo:
```
backend/config/DataBase.txt
```


### 2. Fazer o clone do GitHub
Dentro da pasta que você quer que fique o projeto:
Clique com botão direito, em seguida mostrar mais e "Open with Git Bash here".
Dentro do terminal git, digite "git clone link do repositório" e clique Enter
Agora digite "Cd Nome_do_repositório" e clique Enter
Por mim, digite "Code ." e clique Enter.


### 2. Configurar a senha do banco
Edite `backend/.env` e coloque seus dados:
```js
DB_USER=usuario
DB_PASSWORD=senha
```

### 3. Instalar dependências (só na primeira vez)
```bash
cd backend
npm install -y cors mysql2 express bcryptjs jsonwebtoken dotenv
```

### 4. Iniciar o servidor
```bash
cd backend
node server.js
```

### 5. Abrir no navegador
```
http://localhost:3000
```

---

## Estrutura
```
kuba_tech/
  backend/
    config/
      database.js      ← conexão MySQL (edite a senha aqui)
      DataBase.txt     ← script SQL para criar as tabelas
    routes/
      customerRoutes.js
      deviceRoutes.js
      serviceOrderRoutes.js
    server.js          ← inicie o servidor por aqui
  public/
    index.html         ← Dashboard
    clientes.html
    dispositivos.html
    os.html
    css/style.css
    js/*.js
    img/
```

## Variáveis de ambiente (v3)

| Variável | Uso |
| --- | --- |
| `MP_ACCESS_TOKEN` | Access token do Mercado Pago (Checkout Pro). Sem ele, as cobranças ficam registradas em modo demonstração. |
| `MP_WEBHOOK_URL` | URL pública do webhook `POST /api/billing/webhook`. |
| `BREVO_API_KEY` ou `RESEND_API_KEY` | Envio de e-mails (planos gratuitos). |
| `MAIL_FROM` / `MAIL_FROM_NAME` | Remetente dos e-mails automáticos. |
| `CPF_API_URL` / `CPF_API_TOKEN` | Opcional: API de consulta de CPF (`{cpf}` no lugar do número). |
| `APP_URL` | URL do front (links de pagamento nos e-mails). |

Aplicar as migrações após o deploy: `cd backend && npm run migrate`.
