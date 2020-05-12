#!/bin/bash

for app in $(ls apps); do
    if [ -x "apps/$app/build.sh" ]; then
        (cd apps/$app && ./build.sh)
    fi
done
