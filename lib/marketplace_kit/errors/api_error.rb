module MarketplaceKit
  module Errors
    class ApiError < StandardError
      attr_reader :parsed_response

      def initialize(parsed_response)
        @parsed_response = parsed_response
        super('Invalid API response!')
      end
    end
  end
end
