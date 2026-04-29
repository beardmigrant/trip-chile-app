# 🚀 Setup TripChile EV - Pasos para Jesu

## Paso 1: Verificar Node.js v22 en WSL

```bash
node --version  # debe ser v20+ idealmente v22
```

Si no lo tienes:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

## Paso 2: Configurar SSH para GitHub

```bash
# Crear key si no existe
ssh-keygen -t ed25519 -C "tu_email@github"
# Enter, enter, enter (sin passphrase)

# Mostrar la key pública
cat ~/.ssh/id_ed25519.pub
```

Copia la salida y pégala en:
**GitHub → Settings → SSH and GPG keys → New SSH key**

Verificar:
```bash
ssh -T git@github.com
# "Hi beardmigrant! You've successfully authenticated..."
```

## Paso 3: Crear repo en GitHub

Anda a github.com → New repository:
- Nombre: `trip-chile-app`
- **NO** marcar "Add README"
- **NO** marcar "Add .gitignore"
- **Public**

## Paso 4: Setup local del proyecto

```bash
# Descomprimir el ZIP en tu carpeta de proyectos
cd ~/proyectos
unzip /ruta/al/trip-chile-app.zip
cd trip-chile-app

# Instalar dependencias (toma 2-3 minutos primera vez)
npm install

# Probar localmente
npm run dev
# → Abre http://localhost:3000
```

## Paso 5: Subir a GitHub

```bash
cd ~/proyectos/trip-chile-app

git init
git add .
git commit -m "Initial commit - Next.js setup with map, charging logic, POIs"

# Conectar al repo (reemplaza con tu URL)
git remote add origin git@github.com:beardmigrant/trip-chile-app.git
git branch -M main
git push -u origin main
```

## Paso 6: Deploy en Vercel

1. Ve a https://vercel.com/dashboard
2. Click en **"Add New..."** → **"Project"**
3. Selecciona `trip-chile-app` de tu lista de repos
4. Click **"Deploy"**
5. Espera ~1-2 minutos
6. URL viva: `trip-chile-app-[hash].vercel.app`

## Listo 🎉

Cada `git push` hace deploy automático en Vercel.

## Para próximas iteraciones con Claude

Cuando trabajemos juntos:
1. Yo te paso archivos específicos (no más HTML gigante)
2. Tú los pegas en la ruta correspondiente
3. `npm run dev` para ver cambios en vivo
4. Cuando esté bueno: `git add . && git commit -m "mensaje" && git push`
5. Vercel deploya solo en 30 segundos
