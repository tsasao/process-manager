#!/bin/bash

for app in $(ls apps); do
    if [ -e "apps/$app/requirements.txt" ]; then
        (cd virtualenv-16.7.7; python virtualenv.py ../apps/$app/env)
        (cd apps/$app; source ./env/bin/activate; pip install -r requirements.txt)
    fi
done
