module MarketplaceKit
  module Errors
    class ApiError < StandardError
      attr_reader :parsed_response

      def initialize(parsed_response)
        @parsed_response = parsed_response
        super('Invalid API response!')
      end

      def message
        @parsed_response['error'] || meta_message
      end

      def meta_message
        @parsed_response['meta']['message'] if @parsed_response['meta']
      end

      def details
        @parsed_response['details']
      end
    end
  end
end
