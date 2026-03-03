FROM python:3.11-slim

# Устанавливаем системные зависимости для работы с БД и сетями
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Устанавливаем зависимости Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код проекта
COPY . .

# Команда для запуска (по умолчанию)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]