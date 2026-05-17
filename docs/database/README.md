# FlowCode MySQL setup

1. Import `docs/database/flowcode-mysql.sql` in phpMyAdmin or the XAMPP MySQL console.
2. Create a local `.env.local` file with your XAMPP credentials:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=flowcode
```

3. To create the first admin automatically, add these values before the first login. If the `users` table is empty, the app creates this admin account during login:

```env
FLOWCODE_BOOTSTRAP_ADMIN_USERNAME=admin
FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD=admin123
```

After the first admin exists, create `student`, `teacher`, and `admin` users from `/admin`.
