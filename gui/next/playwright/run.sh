set -eu

pids=( )

# define cleanup function
cleanup() {
  for pid in "${pids[@]}"; do
    kill -0 "$pid" && kill "$pid" # kill process only if it's still running
  done
}

# and set that function to run before we exit, or specifically when we get a SIGTERM
trap cleanup EXIT TERM

export MPKIT_URL="https://qa-poscli-gui.staging.oregon.platform-os.com/"
export MPKIT_TOKEN="MDrBhK3F9YAd12yLl0LuAxOgoCWZqFZ7sGTo8Yw__Uw"
export MPKIT_EMAIL="lukasz@platformos.com"

cd playwright
rm -r -f pos-cli-gui-qa

git clone https://github.com/Platform-OS/pos-cli-gui-qa.git

cd pos-cli-gui-qa

pos-cli data clean --auto-confirm
pos-cli deploy
pos-cli data import --path seed/data.zip --zip

cd ..
cd ..

npm run build

npm run preview & pids+=( "$!" ) &
wait &
pos-cli gui serve & pids+=( "$!" ) &
npx playwright test & pids+=( "$!" )

cd playwright
rm -r -f pos-cli-gui-qa

wait # sleep until all background processes have exited, or a trap fires
