#!/bin/bash

#set -ex

# this script for heroku docker
# when supervisor stops a container it sends SIGTERM all processes, not only root process.

# when argument exists run it.
if [ "$*" != "" -a "$*" != "./start.sh" ]; then
    "$@"
    exit
fi

# starting daemon...
for s in apps/*/setup.sh; do
    if [ -x $s ]; then
        (cd $(dirname $s)  && ./setup.sh)
    fi
done

_term() {
    echo "caught SIGTERM in start.sh"
}
trap _term SIGTERM

_exit() {
    echo "on exit"
}
trap _exit EXIT

node index.js -p $PORT -a &
child=$!

while :
do
    # SIGTERMを送った瞬間にwaitから$?=143(=128+15)で帰ってきてしまうが
    # その時点はプロセスは終了しておらず
    # 再度waitする必要がある
    # 調べたけれど、なんでこうなるのかは不明
    echo "waiting $child..."
    wait $child
    code=$?
    echo "wait returned by code=$code"
    if [ $code -eq 143 ]; then
        echo "but should ignore."
    else
        echo "node terminated by code=$code"
        break
    fi
done

echo "exiting..."
exit 0
