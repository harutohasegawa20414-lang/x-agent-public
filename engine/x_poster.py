import tweepy


class XPoster:
    def __init__(self, api_key=None, api_secret=None, access_token=None, access_token_secret=None):
        """
        Initializes the X API client using OAuth 1.0a User Context (v2).
        外部からAPIキーを受け取れるように変更（アカウント切り替え対応）。
        引数が省略された場合は設定ファイルから読み込む。
        """
        # 引数が渡されていない場合は settings から読み込む
        if not any([api_key, api_secret, access_token, access_token_secret]):
            from config.settings import settings
            api_key = settings.X_API_KEY
            api_secret = settings.X_API_SECRET
            access_token = settings.X_ACCESS_TOKEN
            access_token_secret = settings.X_ACCESS_TOKEN_SECRET

        self.client = None
        if all([api_key, api_secret, access_token, access_token_secret]):
            try:
                self.client = tweepy.Client(
                    consumer_key=api_key,
                    consumer_secret=api_secret,
                    access_token=access_token,
                    access_token_secret=access_token_secret,
                )
            except Exception as e:
                print(f"Error initializing X client: {e}")
        else:
            missing = []
            if not api_key: missing.append("X_API_KEY")
            if not api_secret: missing.append("X_API_SECRET")
            if not access_token: missing.append("X_ACCESS_TOKEN")
            if not access_token_secret: missing.append("X_ACCESS_TOKEN_SECRET")
            print(f"[WARN] Missing X API credentials: {', '.join(missing)}. Only mock mode available.")

    def post_tweet(self, text: str) -> bool:
        """
        Posts a tweet to X using API v2.
        """
        if not self.client:
            print(f"\n[MOCK X POST] Client not initialized. Would have posted:\n{'-'*40}\n{text}\n{'-'*40}\n")
            return False

        try:
            # 各行末の余分な空白を除去し、連続する空行を1つにまとめる
            lines = text.splitlines()
            cleaned_lines = [line.rstrip() for line in lines]
            result = []
            prev_blank = False
            for line in cleaned_lines:
                is_blank = (line.strip() == '')
                if is_blank and prev_blank:
                    continue
                result.append(line)
                prev_blank = is_blank
            text = '\n'.join(result).strip()
            print(f"Attempting to post to X (v2)... ({len(text)}文字)")
            response = self.client.create_tweet(text=text)
            print(f"Successfully posted! Tweet ID: {response.data['id']}")
            return True
        except tweepy.TweepyException as e:
            status_code = None
            if hasattr(e, 'response') and e.response is not None:
                status_code = e.response.status_code
                print(f"Error posting to X: HTTP {status_code} - {e}")
                print(f"Response body: {e.response.text}")
            else:
                print(f"Error posting to X: {e}")
            if status_code == 403:
                print("[HINT] 403: App権限がRead+Writeに設定されているか確認してください。")
            elif status_code == 429:
                print("[HINT] 429: レート制限に達しました。しばらく待ってから再試行してください。")
            return False
        except Exception as e:
            print(f"Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            return False
