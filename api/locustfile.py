from locust import HttpUser, task, between
import random
import json

class WebsiteUser(HttpUser):
    wait_time = between(1, 2)
    host = "http://localhost:8000"  # Assuming the API runs on localhost:8000

    _token = None
    _user_email = None
    _user_password = None

    def on_start(self):
        """ On start, create a user and log in. """
        self.create_and_login_user()

    def create_and_login_user(self):
        # Generate a unique email and password for each user
        self._user_email = f"test_user_{random.randint(0, 1000000)}@example.com"
        self._user_password = "testpassword123"

        # Signup the user
        signup_data = {
            "email": self._user_email,
            "password": self._user_password
        }
        with self.client.post("/signup", json=signup_data, catch_response=True) as response:
            if response.status_code == 201:
                response.success()
                print(f"User {self._user_email} signed up successfully.")
            elif response.status_code == 400 and "Email already registered" in response.text:
                print(f"User {self._user_email} already registered, proceeding to login.")
            else:
                response.failure(f"Signup failed: {response.text}")
                return

        # Login to get a token
        login_data = {
            "username": self._user_email,
            "password": self._user_password
        }
        with self.client.post("/token", data=login_data, catch_response=True) as response:
            if response.status_code == 200:
                self._token = response.json()["access_token"]
                response.success()
                print(f"User {self._user_email} logged in, token obtained.")
            else:
                response.failure(f"Login failed: {response.text}")

    @task(3)
    def get_current_user(self):
        if self._token:
            headers = {"Authorization": f"Bearer {self._token}"}
            self.client.get("/users/me", headers=headers)

    @task(1)
    def list_custom_charts(self):
        if self._token:
            headers = {"Authorization": f"Bearer {self._token}"}
            self.client.get("/custom_charts/", headers=headers)
