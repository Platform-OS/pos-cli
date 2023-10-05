set -eu

export MPKIT_URL="https://qa-poscli-gui.staging.oregon.platform-os.com/"
export MPKIT_TOKEN="MDrBhK3F9YAd12yLl0LuAxOgoCWZqFZ7sGTo8Yw__Uw"
export MPKIT_EMAIL="lukasz@platformos.com"

rm -r -f pos-cli-gui-qa

git clone https://github.com/Platform-OS/pos-cli-gui-qa.git

cd pos-cli-gui-qa

pos-cli deploy
pos-cli data clean --auto-confirm
pos-cli data import --path seed/data.zip --zip

cd ..

npm run build

npm run preview &
wait &
pos-cli gui serve &
npx playwright test --ui
