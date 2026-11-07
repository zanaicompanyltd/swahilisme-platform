# Railway / Heroku-style process definition.
#
# Only used when the service is built with NIXPACKS instead of the Dockerfile
# (repo-root build ⇒ the whole repository lands in /app, so /app/start.sh is
# present). start.sh resolves the import root, $PORT and the bind address; see
# its header comment. With the DOCKERFILE builder this file is ignored and the
# image's CMD ["/app/start.sh"] is used instead.
web: /app/start.sh
