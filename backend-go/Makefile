.PHONY: tidy api worker

tidy:
	go mod tidy

api:
	go run ./cmd/api

worker:
	go run ./cmd/worker

.PHONY: migrate seed api-bg worker-bg stop

migrate:
	go run ./cmd/migrate

seed:
	go run ./cmd/seed

api-bg:
	nohup go run ./cmd/api > server.log 2>&1 & echo $$! > api.pid && sleep 1 && tail -n +1 server.log | sed -n '1,80p'

worker-bg:
	nohup go run ./cmd/worker > worker.log 2>&1 & echo $$! > worker.pid && sleep 1 && tail -n +1 worker.log | sed -n '1,80p'

stop:
	-@[ -f api.pid ] && kill `cat api.pid` || true
	-@[ -f worker.pid ] && kill `cat worker.pid` || true
	@rm -f api.pid worker.pid
