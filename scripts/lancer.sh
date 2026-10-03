#!/bin/bash
# Lanceur macOS / Linux. Fermer la fenêtre arrête l'application.
set -m
cd "$(dirname "$0")/.."

API_PORT=3002
WEB_PORT=5174

if [ "$(uname)" = "Darwin" ]; then
  OPEN=open
else
  OPEN=xdg-open
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

NODE_MAJOR=24
if ! command -v npm >/dev/null 2>&1; then
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "Node.js est introuvable, installation de nvm (gestionnaire de versions Node)..."
    if ! curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash; then
      echo "Installation de nvm impossible (connexion internet ?)."
      echo "   Alternative : installer Node.js depuis https://nodejs.org puis relancer."
      read -r -p "Appuie sur Entrée pour fermer... "
      exit 1
    fi
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
  fi
  echo "Installation de Node.js ${NODE_MAJOR} via nvm..."
  nvm install "$NODE_MAJOR" && nvm alias default "$NODE_MAJOR"
  echo "Node.js $(node --version) installé via nvm (désinstallation : supprimer ~/.nvm)."
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js reste introuvable après l'installation."
  read -r -p "Appuie sur Entrée pour fermer... "
  exit 1
fi

if curl -s --max-time 2 http://localhost:$API_PORT/api/health | grep -q ok \
   && curl -s -o /dev/null --max-time 2 http://localhost:$WEB_PORT; then
  echo "AiDetector tourne déjà, ouverture de la page."
  "$OPEN" http://localhost:$WEB_PORT
  exit 0
fi

if curl -s --max-time 2 http://localhost:$API_PORT/api/health | grep -q ok; then
  echo "Nettoyage d'une instance précédente..."
  # par port : d'autres projets lancent aussi « node --watch dist/main.js »
  for P in $API_PORT $WEB_PORT; do
    PIDS="$(lsof -ti tcp:$P -sTCP:LISTEN 2>/dev/null)"
    [ -n "$PIDS" ] && kill $PIDS 2>/dev/null
  done
  sleep 2
fi

echo "Vérification des dépendances..."
if [ ! -d node_modules ] || [ ! -e node_modules/.bin/vite ] || [ ! -e node_modules/.bin/tsc ] \
   || [ ! -d node_modules/mammoth ] || [ ! -d node_modules/pdfjs-dist ] || [ ! -d node_modules/node-llama-cpp ] \
   || ! node -e "require('rollup/dist/native.js'); require('esbuild').transformSync('1')" >/dev/null 2>&1; then
  echo "Dépendances manquantes ou incomplètes, installation (quelques minutes)..."
  npm install
  echo "Dépendances installées."
else
  echo "Dépendances déjà installées (node_modules complet)."
fi

echo "Préparation du modèle d'analyse (environ 1 Go, une seule fois)..."
if node scripts/warmup-model.mjs; then
  echo "Modèle d'analyse prêt."
else
  echo "Modèle indisponible (hors ligne ?) : l'analyse fonctionnera sans lui."
fi

echo "Démarrage d'AiDetector..."
npm run dev &
DEV_PID=$!

cleanup() {
  echo ""
  echo "Arrêt d'AiDetector..."
  kill -- -"$DEV_PID" 2>/dev/null
  wait "$DEV_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM HUP EXIT

echo "Préparation en cours (compilation du serveur)..."
for _ in $(seq 1 90); do
  if curl -s --max-time 2 http://localhost:$API_PORT/api/health | grep -q ok \
     && curl -s -o /dev/null --max-time 2 http://localhost:$WEB_PORT; then
    sleep 1
    if curl -s --max-time 2 http://localhost:$API_PORT/api/health | grep -q ok; then
      "$OPEN" http://localhost:$WEB_PORT
      break
    fi
  fi
  sleep 1
done

if [ "$(uname -s)" = "Darwin" ]; then
  LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
else
  LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi

echo ""
echo "AiDetector est ouvert : http://localhost:$WEB_PORT"
if [ -n "$LOCAL_IP" ]; then
  echo "Accès réseau local (autre appareil du même réseau) : http://${LOCAL_IP}:$WEB_PORT"
fi
echo "   Laisse cette fenêtre ouverte pendant l'utilisation."
echo "   Pour arrêter : ferme cette fenêtre (ou Ctrl+C)."
wait "$DEV_PID"
