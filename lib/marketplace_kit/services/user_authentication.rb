require 'base64'
require 'uri'

module MarketplaceKit
  module Services
    class UserAuthentication
      include Services::Loggable

      def authenticate
        return unless requires_login?

        credentials = parse_endpoint_url || ask_for_email_and_password
        login_and_remember credentials
      end

      protected

      def requires_login?
        MarketplaceKit.config.token.empty? || gateway.login_required?
      end

      def ask_for_email_and_password
        log :ask_for_email
        email = STDIN.gets.chomp

        log :ask_for_password
        password = STDIN.noecho(&:gets).chomp

        { email: email, password: password }
      end

      def login_and_remember(credentials)
        user_token = gateway.login credentials[:email], credentials[:password]
        MarketplaceKit.config.set_token user_token
      end

      def parse_endpoint_url
        userinfo        = URI(MarketplaceKit.config.url).userinfo || ''
        email, password = Base64.urlsafe_decode64(userinfo).split(':')
        return false if !email || !password
        { email: email, password: password }
      end

      private

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
