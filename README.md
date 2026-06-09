# Kuba Tech — Sistema de Gestão

## Como rodar

### 1. Criar o banco de dados no MySQL
Abra o MySQL Workbench (ou terminal mysql) e execute o conteúdo do arquivo:
```
backend/config/DataBase.txt
```

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
