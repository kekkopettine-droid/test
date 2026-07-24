#!/bin/bash
cd "$(dirname "$0")"
echo "Avvio Server Abstergo sulla rete locale..."
echo "Il tuo telefono può ora scansionare il QR code del biglietto!"
echo "(Non chiudere questa finestra se vuoi continuare a usare il QR code sul telefono)"
python3 -m http.server 8000
