Pular para a caixa de texto do chat

Project Blueprint

Visualização
Arquivos
Código
Mais




Code

Read only










Search code

frontend/css/login.css
frontend/css/style.css
frontend/html/cadastro.html
frontend/html/clientes.html
frontend/html/dispositivos.html
frontend/html/index.html
frontend/html/login.html
frontend/html/os.html
frontend/js/cadastro.js
frontend/js/clientes.js
frontend/js/config.js
frontend/js/dashboard.js
frontend/js/dispositivos.js
frontend/js/login.js
frontend/js/os.js
frontend/js/shared.js
frontend/index.html
.gitignore
README.md
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
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
