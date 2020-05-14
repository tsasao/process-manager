FROM python:3.7

WORKDIR /app

# install virtualenv
RUN curl -sL https://github.com/pypa/virtualenv/archive/16.7.7.tar.gz | tar xzf -
ENV PATH $PATH:/app/virtualenv-16.7.7

# install node
RUN mkdir node
RUN curl -s https://s3pository.heroku.com/node/v10.15.0/node-v10.15.0-linux-x64.tar.gz | tar --strip-components=1 -xz -C node
ENV PATH $PATH:/app/node/bin

# install node js packages
COPY package.json package-lock.json ./
RUN npm install

# copy everything
COPY . .

RUN ./build.sh

ENTRYPOINT [ "./start.sh" ]
