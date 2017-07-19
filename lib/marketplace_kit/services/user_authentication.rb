module MarketplaceKit
  module Services
    class UserAuthentication
      def authenticate
        return unless requires_login?

        credentials = ask_for_email_and_password
        login_and_remember credentials
      end

      protected

      def requires_login?
        MarketplaceKit.config.token.empty? || gateway.login_required?
      end

      def ask_for_email_and_password
        puts "Enter your email"
        email = STDIN.gets.chomp

        puts "Enter your password"
        password = STDIN.noecho(&:gets).chomp

        { email: email, password: password }
      end

      def login_and_remember(credentials)
        user_token = gateway.login credentials[:email], credentials[:password]
        MarketplaceKit.config.set_token user_token
      end

      private

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
